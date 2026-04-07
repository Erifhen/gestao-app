import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Plus, Trash2, CheckSquare,
  Square, ChevronLeft, ChevronRight, X, Edit2, Settings,
  PieChart, Tag as TagIcon, Download, Upload, AlertCircle
} from 'lucide-react';

const STORAGE_KEY = 'finance_manager_data_v4';

const App = () => {
  // --- ESTADO ---
  const [data, setData] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {
      boletos: [],
      entities: [
        { id: '1', name: 'Entidade Alfa', active: true, color: '#10b981' },
        { id: '2', name: 'Entidade Beta', active: true, color: '#3b82f6' }
      ]
    };
  });

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modais
  const [isBoletoModalOpen, setIsBoletoModalOpen] = useState(false);
  const [isEntityConfigOpen, setIsEntityConfigOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState(null);
  const [editingBoletoId, setEditingBoletoId] = useState(null);

  // Form States
  const [newBoleto, setNewBoleto] = useState({
    nome: '', entidadeId: '', valorTotal: '', vencimento: '',
    pago: false, repetir: false, tags: []
  });
  const [tempTag, setTempTag] = useState({ label: '', value: '' });

  // --- PERSISTÊNCIA ---
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  // --- AUXILIARES DE DATA ---
  const parseDateLocal = (dateStr) => {
    if (!dateStr) return new Date();
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const monthName = currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  const changeMonth = (offset) => {
    const next = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
    setCurrentDate(next);
    setSelectedDay(null);
  };

  const getInitials = (name) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // --- FILTRAGEM ---
  const activeEntityIds = useMemo(() =>
    data.entities.filter(e => e.active).map(e => e.id),
    [data.entities]
  );

  const filteredBoletos = useMemo(() => {
    return data.boletos.filter(b => {
      const bDate = parseDateLocal(b.vencimento);
      const isSameMonth = bDate.getMonth() === currentDate.getMonth() && bDate.getFullYear() === currentDate.getFullYear();
      const matchesSearch = b.nome.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesEntity = activeEntityIds.includes(b.entidadeId);
      return isSameMonth && matchesSearch && matchesEntity;
    });
  }, [data.boletos, currentDate, searchQuery, activeEntityIds]);

  const tagAnalytics = useMemo(() => {
    const totals = {};
    filteredBoletos.forEach(b => {
      if (b.tags && b.tags.length > 0) {
        b.tags.forEach(t => {
          const label = t.label.trim().toLowerCase();
          const val = parseFloat(t.value) || 0;
          totals[label] = (totals[label] || 0) + val;
        });
      } else {
        const val = parseFloat(b.valorTotal) || 0;
        totals['sem categoria'] = (totals['sem categoria'] || 0) + val;
      }
    });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [filteredBoletos]);

  const stats = useMemo(() => {
    const targetBoletos = selectedDay
      ? filteredBoletos.filter(b => parseDateLocal(b.vencimento).getDate() === selectedDay)
      : filteredBoletos;

    return targetBoletos.reduce((acc, b) => {
      const val = parseFloat(b.valorTotal) || 0;
      if (b.pago) acc.pago += val; else acc.pendente += val;
      return acc;
    }, { pago: 0, pendente: 0 });
  }, [filteredBoletos, selectedDay]);

  // --- AÇÕES CRUD ---
  const openEditBoleto = (boleto) => {
    setEditingBoletoId(boleto.id);
    setNewBoleto({ ...boleto });
    setIsBoletoModalOpen(true);
  };

  const handleAddOrUpdateBoleto = (e) => {
    e.preventDefault();
    if (!newBoleto.entidadeId || !newBoleto.vencimento) return;

    if (editingBoletoId) {
      setData(prev => ({
        ...prev,
        boletos: prev.boletos.map(b => b.id === editingBoletoId ? { ...newBoleto } : b)
      }));
    } else {
      const id = crypto.randomUUID();
      setData(prev => ({
        ...prev,
        boletos: [...prev.boletos, { ...newBoleto, id }]
      }));
    }
    closeBoletoModal();
  };

  const closeBoletoModal = () => {
    setEditingBoletoId(null);
    setNewBoleto({
      nome: '', entidadeId: '', valorTotal: '', vencimento: '',
      pago: false, repetir: false, tags: []
    });
    setTempTag({ label: '', value: '' });
    setIsBoletoModalOpen(false);
  };

  const deleteBoleto = (id) => {
    setData(prev => ({
      ...prev,
      boletos: prev.boletos.filter(b => b.id !== id)
    }));
  };

  const toggleBoletoStatus = (id, field) => {
    setData(prev => ({
      ...prev,
      boletos: prev.boletos.map(b => b.id === id ? { ...b, [field]: !b[field] } : b)
    }));
  };

  // --- IMPORT/EXPORT ---
  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance_export_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (json.boletos && json.entities) {
          setData(json);
        }
      } catch (err) {
        console.error("Erro ao importar arquivo");
      }
    };
    reader.readAsText(file);
  };

  const addTagToForm = () => {
    if (!tempTag.label || !tempTag.value) return;
    setNewBoleto(prev => ({
      ...prev,
      tags: [...prev.tags, { ...tempTag, id: crypto.randomUUID() }]
    }));
    setTempTag({ label: '', value: '' });
  };

  const removeTagFromForm = (id) => {
    setNewBoleto(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t.id !== id)
    }));
  };

  const handleSaveEntity = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const name = formData.get('name');
    const color = formData.get('color');

    if (editingEntity) {
      setData(prev => ({
        ...prev,
        entities: prev.entities.map(ent => ent.id === editingEntity.id ? { ...ent, name, color } : ent)
      }));
    } else {
      setData(prev => ({
        ...prev,
        entities: [...prev.entities, { id: crypto.randomUUID(), name, color, active: true }]
      }));
    }
    setEditingEntity(null);
  };

  return (
    /* 1. Ajuste no container pai: h-screen vira min-h-screen para permitir que o conteúdo cresça no mobile */
    <div className="flex flex-col md:flex-row min-h-screen bg-[#0a0c10] text-slate-300 font-sans">

      {/* SIDEBAR / HEADER MOBILE */}
      <aside className="
      w-full md:w-72 
      border-b md:border-b-0 md:border-r border-slate-800 
      p-4 md:p-6 
      flex flex-col gap-4 md:gap-6 
      bg-[#0a0c10] 
      /* No mobile: estático e altura automática. No desktop: fixo no topo com altura da tela */
      relative md:sticky md:top-0 
      h-auto md:h-screen 
      shrink-0 
      /* No mobile não scrolla individualmente, no desktop sim */
      overflow-visible md:overflow-y-auto"
      >
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
          Gestão Financeira
        </h1>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar pagamento..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
          />
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => setIsBoletoModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-semibold transition-all active:scale-95 shadow-lg shadow-emerald-900/20"
          >
            <Plus size={18} /> Novo Lançamento
          </button>

          <button
            onClick={() => setIsAnalyticsOpen(true)}
            className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 py-3 rounded-xl font-semibold transition-all"
          >
            <PieChart size={18} /> Resumo Categorias
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={exportData}
            className="flex flex-col items-center justify-center gap-1 bg-slate-900 border border-slate-800 p-2 rounded-xl text-[10px] font-bold text-slate-400 hover:text-white transition-colors"
          >
            <Download size={14} /> EXPORTAR
          </button>
          <label className="flex flex-col items-center justify-center gap-1 bg-slate-900 border border-slate-800 p-2 rounded-xl text-[10px] font-bold text-slate-400 hover:text-white transition-colors cursor-pointer">
            <Upload size={14} /> IMPORTAR
            <input type="file" accept=".json" onChange={importData} className="hidden" />
          </label>
        </div>

        <div className="mt-4 md:mt-auto flex flex-col gap-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Entidades Ativas</p>
          <div className="flex flex-wrap gap-2 pb-2">
            {data.entities.map(ent => (
              <button
                key={ent.id}
                onClick={() => setData(prev => ({ ...prev, entities: prev.entities.map(e => e.id === ent.id ? { ...e, active: !e.active } : e) }))}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${ent.active ? 'border-transparent text-white' : 'border-slate-800 text-slate-600 bg-transparent'}`}
                style={{ backgroundColor: ent.active ? ent.color : 'transparent' }}
              >
                {getInitials(ent.name)}
              </button>
            ))}
            <button onClick={() => setIsEntityConfigOpen(true)} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 hover:text-white transition-colors">
              <Settings size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ÁREA CENTRAL */}
      <main className="
      flex-1 
      flex flex-col 
      p-4 md:p-8 
      /* Importante: No mobile, o overflow deve ser visível para que o scroll suba a sidebar junto */
      overflow-visible md:overflow-y-auto 
      no-scrollbar"
      >
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-4 md:gap-6">
            <h2 className="text-xl md:text-4xl font-light text-white capitalize">{monthName}</h2>
            <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800">
              <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-800 rounded-lg"><ChevronLeft size={20} /></button>
              <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-800 rounded-lg"><ChevronRight size={20} /></button>
            </div>
          </div>
          {selectedDay && (
            <button onClick={() => setSelectedDay(null)} className="text-xs bg-emerald-500/10 text-emerald-500 px-3 py-1.5 rounded-full border border-emerald-500/20">
              Ver mês inteiro
            </button>
          )}
        </header>

        {/* CALENDÁRIO RESPONSIVO */}
        <div className="grid grid-cols-7 gap-1 md:gap-4 auto-rows-fr">
          {[...Array(daysInMonth)].map((_, i) => {
            const day = i + 1;
            const isSelected = selectedDay === day;
            const dayBoletos = filteredBoletos.filter(b => parseDateLocal(b.vencimento).getDate() === day);
            const hasPending = dayBoletos.some(b => !b.pago);

            return (
              <div
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`relative rounded-lg md:rounded-2xl border transition-all cursor-pointer flex flex-col p-1.5 md:p-3 min-h-[50px] md:min-h-[120px]
                  ${isSelected ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/50' : 'bg-slate-900/30 border-slate-800 hover:border-slate-600'}
                `}
              >
                <span className={`text-xs md:text-xl font-medium ${isSelected ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {day}
                </span>

                {/* Visualização Desktop: Texto do boleto */}
                <div className="hidden md:flex mt-2 flex-col gap-1 overflow-hidden">
                  {dayBoletos.map(b => (
                    <div key={b.id} className="flex items-center gap-1.5 overflow-hidden">
                      <div className="min-w-[4px] h-3 rounded-full shrink-0" style={{ backgroundColor: data.entities.find(e => e.id === b.entidadeId)?.color }} />
                      <span className={`text-[10px] truncate ${b.pago ? 'text-slate-600 line-through' : 'text-slate-300'}`}>{b.nome}</span>
                    </div>
                  ))}
                </div>

                {/* Visualização Mobile: Pontos indicadores */}
                <div className="flex md:hidden flex-wrap gap-0.5 mt-1">
                  {dayBoletos.map(b => (
                    <div key={b.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: data.entities.find(e => e.id === b.entidadeId)?.color }} />
                  ))}
                </div>

                {dayBoletos.length > 0 && (
                  <div className={`absolute top-1 right-1 md:top-3 md:right-3 w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${hasPending ? 'bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)]' : 'bg-emerald-500'}`}></div>
                )}
              </div>
            );
          })}
        </div>

        {/* LISTA DE ITENS RESPONSIVA */}
        <section className="mt-8 md:mt-10 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <div className="w-1 h-5 bg-emerald-500 rounded-full"></div>
            {selectedDay ? `Dia ${selectedDay}` : 'Mês Inteiro'}
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
            {(selectedDay ? filteredBoletos.filter(b => parseDateLocal(b.vencimento).getDate() === selectedDay) : filteredBoletos).map(b => (
              <div key={b.id} className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition-colors group relative">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex gap-3 md:gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ backgroundColor: `${data.entities.find(e => e.id === b.entidadeId)?.color}20`, color: data.entities.find(e => e.id === b.entidadeId)?.color }}>
                      {getInitials(data.entities.find(e => e.id === b.entidadeId)?.name || '??')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className={`font-bold text-white break-words leading-tight ${b.pago ? 'line-through opacity-50' : ''}`}>{b.nome}</h4>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-1">
                        {data.entities.find(e => e.id === b.entidadeId)?.name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2 border-t border-slate-800/50 pt-3 sm:pt-0 sm:border-0">
                    <p className="font-mono text-base md:text-lg font-bold text-white">
                      {parseFloat(b.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEditBoleto(b)} className="p-2 text-slate-500 hover:text-emerald-400"><Edit2 size={18} /></button>
                      <button onClick={() => deleteBoleto(b.id)} className="p-2 text-slate-500 hover:text-rose-500"><Trash2 size={18} /></button>
                      <button onClick={() => toggleBoletoStatus(b.id, 'pago')} className="transition-transform active:scale-90 ml-1">
                        {b.pago ? <CheckSquare className="text-emerald-500" size={24} /> : <Square className="text-slate-700" size={24} />}
                      </button>
                    </div>
                  </div>
                </div>

                {b.tags && b.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-800/30 pt-3">
                    {b.tags.map(t => (
                      <div key={t.id} className="flex items-center gap-2 bg-slate-800/30 px-2 py-1 rounded-lg border border-slate-700/30">
                        <span className="text-[10px] text-emerald-400 font-bold whitespace-nowrap">#{t.label}</span>
                        <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">{parseFloat(t.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* RESUMO FINANCEIRO RODAPÉ */}
        <footer className="mt-8 md:mt-12 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 pb-10">
          <div className="bg-gradient-to-br from-slate-900 to-[#0a0c10] border border-slate-800 p-4 md:p-6 rounded-2xl md:rounded-3xl flex justify-between items-center">
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">A Pagar</p>
              <p className="text-xl md:text-3xl font-mono text-rose-500 font-bold">
                {stats.pendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
            <div className="w-10 h-10 md:w-12 md:h-12 bg-rose-500/10 rounded-xl md:rounded-2xl flex items-center justify-center text-rose-500 shrink-0">
              <AlertCircle size={20} />
            </div>
          </div>
          <div className="bg-gradient-to-br from-slate-900 to-[#0a0c10] border border-slate-800 p-4 md:p-6 rounded-2xl md:rounded-3xl flex justify-between items-center">
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Quitado</p>
              <p className="text-xl md:text-3xl font-mono text-emerald-500 font-bold">
                {stats.pago.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
            <div className="w-10 h-10 md:w-12 md:h-12 bg-emerald-500/10 rounded-xl md:rounded-2xl flex items-center justify-center text-emerald-500 shrink-0">
              <CheckSquare size={20} />
            </div>
          </div>
        </footer>
      </main>

      {/* MODAL: NOVO/EDITAR LANÇAMENTO */}
      {isBoletoModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form onSubmit={handleAddOrUpdateBoleto} className="bg-[#161a21] border-t sm:border border-slate-800 w-full max-w-2xl rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
            <header className="p-4 md:p-6 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-lg md:text-xl font-bold">{editingBoletoId ? 'Editar' : 'Novo Pagamento'}</h3>
              <button type="button" onClick={closeBoletoModal} className="p-2 text-slate-500 hover:text-white"><X /></button>
            </header>

            <div className="p-4 md:p-6 space-y-6 overflow-y-auto no-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Descrição</label>
                    <input required placeholder="Ex: Cartão de Crédito" value={newBoleto.nome} onChange={e => setNewBoleto({ ...newBoleto, nome: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 outline-none focus:ring-1 focus:ring-emerald-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Valor Total</label>
                      <input required type="number" step="0.01" placeholder="0,00" value={newBoleto.valorTotal} onChange={e => setNewBoleto({ ...newBoleto, valorTotal: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-emerald-400" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Vencimento</label>
                      <input required type="date" value={newBoleto.vencimento} onChange={e => setNewBoleto({ ...newBoleto, vencimento: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 outline-none focus:ring-1 focus:ring-emerald-500 text-xs" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Entidade Pagadora</label>
                    <select required value={newBoleto.entidadeId} onChange={e => setNewBoleto({ ...newBoleto, entidadeId: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 outline-none focus:ring-1 focus:ring-emerald-500">
                      <option value="">Selecione...</option>
                      {data.entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex items-center gap-2 text-emerald-500 mb-2">
                    <TagIcon size={16} />
                    <h4 className="text-xs uppercase font-bold tracking-widest">Itens Detalhados</h4>
                  </div>

                  <div className="flex flex-col gap-2">
                    <input placeholder="Categoria (ex: Uber, Mercado)" value={tempTag.label} onChange={e => setTempTag({ ...tempTag, label: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs outline-none" />
                    <div className="flex gap-2">
                      <input type="number" placeholder="Valor" value={tempTag.value} onChange={e => setTempTag({ ...tempTag, value: e.target.value })} className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs outline-none" />
                      <button type="button" onClick={addTagToForm} className="bg-emerald-600 px-4 rounded-lg text-white font-bold text-xs">Add</button>
                    </div>
                  </div>

                  <div className="space-y-2 mt-4 max-h-[150px] overflow-y-auto no-scrollbar">
                    {newBoleto.tags.map(t => (
                      <div key={t.id} className="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-slate-800">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-emerald-500 font-bold">#{t.label}</span>
                          <span className="text-xs font-mono text-slate-300">R$ {parseFloat(t.value).toFixed(2)}</span>
                        </div>
                        <button type="button" onClick={() => removeTagFromForm(t.id)} className="text-slate-600 hover:text-rose-500 p-1"><X size={14} /></button>
                      </div>
                    ))}
                    {newBoleto.tags.length === 0 && <p className="text-[10px] text-slate-600 italic text-center py-4">Nenhuma categoria detalhada.</p>}
                  </div>
                </div>
              </div>
            </div>

            <footer className="p-4 md:p-6 bg-slate-900/50 border-t border-slate-800 flex gap-3">
              <button type="button" onClick={closeBoletoModal} className="flex-1 py-3 rounded-xl border border-slate-800 text-slate-500 font-bold text-sm">Cancelar</button>
              <button type="submit" className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm">
                Salvar
              </button>
            </footer>
          </form>
        </div>
      )}

      {/* OUTROS MODAIS */}
      {isAnalyticsOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-[#161a21] border border-slate-800 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl">
            <header className="p-6 border-b border-slate-800 flex justify-between items-center bg-emerald-500/5">
              <h3 className="text-xl font-bold text-white flex items-center gap-2"><PieChart className="text-emerald-500" /> Gastos</h3>
              <button onClick={() => setIsAnalyticsOpen(false)} className="text-slate-500 p-2"><X /></button>
            </header>
            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-4 no-scrollbar">
              {tagAnalytics.length === 0 ? (
                <p className="text-center py-20 text-slate-600 italic">Sem categorias cadastradas.</p>
              ) : (
                tagAnalytics.map(([label, total]) => {
                  const totalMonth = tagAnalytics.reduce((a, b) => a + b[1], 0);
                  const perc = ((total / totalMonth) * 100).toFixed(1);
                  return (
                    <div key={label} className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-bold text-emerald-500 uppercase text-xs tracking-widest">#{label}</span>
                        <span className="font-mono text-white font-bold text-sm">{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${perc}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {isEntityConfigOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-[#161a21] border border-slate-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl">
            <header className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-xl font-bold">Entidades</h3>
              <button onClick={() => setIsEntityConfigOpen(false)} className="text-slate-500 p-2"><X /></button>
            </header>
            <div className="p-6 space-y-6">
              <div className="space-y-2 max-h-[40vh] overflow-y-auto no-scrollbar">
                {data.entities.map(ent => (
                  <div key={ent.id} className="flex items-center justify-between bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: ent.color, color: 'white' }}>{getInitials(ent.name)}</div>
                      <span className="text-sm font-medium">{ent.name}</span>
                    </div>
                    <button onClick={() => setEditingEntity(ent)} className="p-2 text-slate-500 hover:text-white"><Edit2 size={16} /></button>
                  </div>
                ))}
              </div>
              <form onSubmit={handleSaveEntity} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-4">
                <input name="name" required defaultValue={editingEntity?.name || ''} placeholder="Nome da entidade" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 outline-none focus:ring-1 focus:ring-emerald-500 text-sm" />
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Cor</span>
                  <input name="color" type="color" defaultValue={editingEntity?.color || '#10b981'} className="w-10 h-10 bg-transparent border-0 cursor-pointer" />
                </div>
                <button type="submit" className="w-full bg-emerald-600 text-white py-2 rounded-xl font-bold text-sm">{editingEntity ? 'Salvar' : 'Criar'}</button>
              </form>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        input[type="date"]::-webkit-calendar-picker-indicator {
          filter: invert(1);
        }
      `}</style>
    </div>
  );
};

export default App;