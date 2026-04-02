import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Trash2, Printer, Repeat, CheckCircle, XCircle, ChevronLeft, ChevronRight, X } from 'lucide-react';

const STORAGE_KEY = 'finance_manager_data_v1';

const App = () => {
  // --- ESTADO ---
  const [data, setData] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : { boletos: [], entities: [
      { id: '1', name: 'Empresa A', active: true, color: '#10b981' },
      { id: '2', name: 'Empresa B', active: true, color: '#3b82f6' }
    ] };
  });

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDays, setSelectedDays] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isBoletoModalOpen, setIsBoletoModalOpen] = useState(false);
  const [isDayDetailOpen, setIsDayDetailOpen] = useState(null); // Armazena o dia selecionado (1-31)
  const [isEntityModalOpen, setIsEntityModalOpen] = useState(false);

  // Form State para Novo Boleto
  const [newBoleto, setNewBoleto] = useState({
    nome: '',
    entidadeId: '',
    valor: '',
    vencimento: '',
    pago: false,
    repetir: false,
    emitido: false
  });

  // --- PERSISTÊNCIA ---
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  // --- LÓGICA DE CALENDÁRIO ---
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const monthName = currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  const changeMonth = (offset) => {
    const next = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
    setCurrentDate(next);
    setSelectedDays([]);
  };

  // --- FILTRAGEM E CÁLCULOS ---
  const activeEntityIds = useMemo(() => 
    data.entities.filter(e => e.active).map(e => e.id), 
    [data.entities]
  );

  const filteredBoletos = useMemo(() => {
    return data.boletos.filter(b => {
      const bDate = new Date(b.vencimento);
      const isSameMonth = bDate.getMonth() === currentDate.getMonth() && bDate.getFullYear() === currentDate.getFullYear();
      
      // Lógica de Repetição: Aparece se for o mesmo dia do mês, independente do ano/mês (se for data futura ou igual)
      const isRepeated = b.repetir && bDate.getDate() && (new Date(b.vencimento) <= new Date(currentDate.getFullYear(), currentDate.getMonth(), bDate.getDate()));
      
      const matchesSearch = b.nome.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesEntity = activeEntityIds.includes(b.entidadeId);
      
      return (isSameMonth || isRepeated) && matchesSearch && matchesEntity;
    });
  }, [data.boletos, currentDate, searchQuery, activeEntityIds]);

  // Totais baseados nos DIAS SELECIONADOS e ENTIDADES ATIVAS
  const stats = useMemo(() => {
    const targetBoletos = filteredBoletos.filter(b => {
      const d = new Date(b.vencimento).getDate();
      return selectedDays.length === 0 || selectedDays.includes(d);
    });

    return targetBoletos.reduce((acc, b) => {
      const val = parseFloat(b.valor) || 0;
      if (b.pago) acc.pago += val;
      else acc.pendente += val;
      return acc;
    }, { pago: 0, pendente: 0 });
  }, [filteredBoletos, selectedDays]);

  // --- AÇÕES ---
  const handleAddBoleto = (e) => {
    e.preventDefault();
    const id = crypto.randomUUID();
    setData(prev => ({
      ...prev,
      boletos: [...prev.boletos, { ...newBoleto, id }]
    }));
    setIsBoletoModalOpen(false);
    setNewBoleto({ nome: '', entidadeId: '', valor: '', vencimento: '', pago: false, repetir: false, emitido: false });
  };

  const toggleBoletoStatus = (id, field) => {
    setData(prev => ({
      ...prev,
      boletos: prev.boletos.map(b => b.id === id ? { ...b, [field]: !b[field] } : b)
    }));
  };

  const deleteBoleto = (id) => {
    setData(prev => ({
      ...prev,
      boletos: prev.boletos.filter(b => b.id !== id)
    }));
  };

  const toggleEntity = (id) => {
    setData(prev => ({
      ...prev,
      entities: prev.entities.map(e => e.id === id ? { ...e, active: !e.active } : e)
    }));
  };

  const deselectAll = () => {
    setSelectedDays([]);
    setData(prev => ({
      ...prev,
      entities: prev.entities.map(e => ({ ...e, active: false }))
    }));
  };

  const toggleDaySelection = (day) => {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  return (
    <div className="flex h-screen bg-[#0f1115] text-slate-300 overflow-hidden font-sans">
      
      {/* BARRA ESQUERDA: BUSCA E ADICIONAR */}
      <aside className="w-72 border-r border-slate-800 p-6 flex flex-col gap-6 bg-[#0f1115]">
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
            Gestão Financeira
          </h1>
          <p className="text-xs text-slate-500 uppercase tracking-widest">Pagamentos futuros</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input 
            type="text" 
            placeholder="Pesquisar boletos..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
          />
        </div>

        <button 
          onClick={() => setIsBoletoModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-semibold shadow-lg shadow-emerald-900/20 transition-all active:scale-95"
        >
          <Plus size={18} /> Novo Boleto
        </button>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
          {searchQuery && (
            <div className="text-xs text-slate-500 px-2 py-1">Resultados da busca:</div>
          )}
          {filteredBoletos.filter(b => b.nome.toLowerCase().includes(searchQuery.toLowerCase())).map(b => (
            <div key={b.id} className="p-3 bg-slate-900/30 border border-slate-800 rounded-lg flex justify-between items-center group">
              <div>
                <p className="text-sm font-medium text-slate-200">{b.nome}</p>
                <p className="text-[10px] text-slate-500">{new Date(b.vencimento).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => deleteBoleto(b.id)} className="p-1 hover:text-red-400"><Trash2 size={14}/></button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* ÁREA CENTRAL: CALENDÁRIO */}
      <main className="flex-1 flex flex-col p-8 relative">
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-light text-white capitalize">{monthName}</h2>
            <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
              <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-800 rounded-md transition-colors"><ChevronLeft size={20}/></button>
              <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-800 rounded-md transition-colors"><ChevronRight size={20}/></button>
            </div>
          </div>
          
          <div className="text-right">
            <p className="text-xs text-slate-500 uppercase tracking-tighter">Hoje</p>
            <p className="text-sm font-mono text-emerald-500">{new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </header>

        {/* GRID DO CALENDÁRIO */}
        <div className="grid grid-cols-7 gap-3 flex-1 auto-rows-fr">
          {[...Array(daysInMonth)].map((_, i) => {
            const day = i + 1;
            const isSelected = selectedDays.includes(day);
            const dayBoletos = filteredBoletos.filter(b => new Date(b.vencimento).getDate() === day);
            const hasPending = dayBoletos.some(b => !b.pago);
            const allPaid = dayBoletos.length > 0 && dayBoletos.every(b => b.pago);

            return (
              <div 
                key={day}
                onClick={() => toggleDaySelection(day)}
                onDoubleClick={() => setIsDayDetailOpen(day)}
                className={`relative rounded-2xl border transition-all cursor-pointer group flex flex-col p-4
                  ${isSelected 
                    ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.1)]' 
                    : 'bg-slate-900/20 border-slate-800 hover:border-slate-700'}
                `}
              >
                <span className={`text-lg font-medium mb-1 ${isSelected ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
                  {day}
                </span>
                
                <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                  {dayBoletos.slice(0, 2).map(b => (
                    <div key={b.id} className="text-[10px] truncate flex items-center gap-1 bg-slate-800/50 px-1.5 py-0.5 rounded">
                      <div className={`w-1 h-1 rounded-full ${b.pago ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                      {b.nome}
                    </div>
                  ))}
                  {dayBoletos.length > 2 && (
                    <span className="text-[9px] text-slate-600 font-bold">+{dayBoletos.length - 2} itens</span>
                  )}
                </div>

                {/* Status Indicator */}
                {dayBoletos.length > 0 && (
                  <div className={`absolute bottom-3 right-3 w-2 h-2 rounded-full ${hasPending ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                )}
              </div>
            );
          })}
        </div>

        {/* SALDOS INFERIORES */}
        <footer className="mt-8 grid grid-cols-3 gap-6">
          <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl">
            <p className="text-[10px] uppercase text-slate-500 font-bold tracking-widest mb-1">Total Pendente</p>
            <p className="text-3xl font-mono text-rose-500">
              {stats.pendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl">
            <p className="text-[10px] uppercase text-slate-500 font-bold tracking-widest mb-1">Total Quitado</p>
            <p className="text-3xl font-mono text-emerald-500">
              {stats.pago.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </div>
          <div className="bg-emerald-600 p-5 rounded-2xl flex flex-col justify-center">
             <p className="text-[10px] uppercase text-emerald-100 font-bold tracking-widest mb-1">Dias Selecionados</p>
             <p className="text-3xl font-bold text-white">{selectedDays.length || 'Todos'}</p>
          </div>
        </footer>
      </main>

      {/* BARRA DIREITA: ENTIDADES */}
      <aside className="w-24 border-l border-slate-800 p-4 flex flex-col items-center gap-6 bg-[#0f1115]">
        <button 
          onClick={deselectAll}
          className="text-[10px] uppercase bg-slate-800 hover:bg-slate-700 p-2 rounded-lg text-center leading-tight transition-colors active:scale-90"
        >
          Limpar Filtros
        </button>

        <div className="flex flex-col gap-4 overflow-y-auto flex-1 w-full items-center custom-scrollbar">
          {data.entities.map(ent => (
            <div key={ent.id} className="relative group flex flex-col items-center gap-1">
              <button 
                onClick={() => toggleEntity(ent.id)}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 border-2
                  ${ent.active 
                    ? 'scale-110 shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                    : 'opacity-30 grayscale border-transparent bg-slate-800'}
                `}
                style={{ borderColor: ent.active ? ent.color : 'transparent', backgroundColor: '#1e293b' }}
              >
                <span className="text-lg font-bold" style={{ color: ent.active ? ent.color : '#64748b' }}>
                  {ent.name.substring(0, 2).toUpperCase()}
                </span>
              </button>
              <span className="text-[9px] text-slate-500 text-center truncate w-full">{ent.name}</span>
            </div>
          ))}

          <button 
            onClick={() => setIsEntityModalOpen(true)}
            className="w-12 h-12 rounded-full border-2 border-dashed border-slate-800 flex items-center justify-center text-slate-600 hover:border-emerald-500 hover:text-emerald-500 transition-all active:scale-90"
          >
            <Plus size={20} />
          </button>
        </div>
      </aside>

      {/* MODAIS */}
      
      {/* 1. Modal Detalhes do Dia */}
      {isDayDetailOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1d23] border border-slate-800 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl">
            <header className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h3 className="text-xl font-bold text-white">Pagamentos do Dia {isDayDetailOpen}</h3>
              <button onClick={() => setIsDayDetailOpen(null)} className="p-2 hover:bg-slate-800 rounded-full"><X/></button>
            </header>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {filteredBoletos.filter(b => new Date(b.vencimento).getDate() === isDayDetailOpen).length === 0 ? (
                <p className="text-center text-slate-500 py-8 italic">Nenhum boleto para este dia.</p>
              ) : (
                filteredBoletos.filter(b => new Date(b.vencimento).getDate() === isDayDetailOpen).map(b => (
                  <div key={b.id} className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-white">{b.nome}</span>
                        {b.repetir && <Repeat size={12} className="text-blue-400" />}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-3">
                        <span className="font-mono text-emerald-400">{parseFloat(b.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        <span>•</span>
                        <span>{data.entities.find(e => e.id === b.entidadeId)?.name}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => toggleBoletoStatus(b.id, 'emitido')}
                        className={`p-2 rounded-lg transition-colors ${b.emitido ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-600'}`}
                        title="Impresso/Emitido"
                      >
                        <Printer size={18} />
                      </button>
                      <button 
                        onClick={() => toggleBoletoStatus(b.id, 'pago')}
                        className={`p-2 rounded-lg transition-colors ${b.pago ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-600'}`}
                      >
                        {b.pago ? <CheckCircle size={18} /> : <XCircle size={18} />}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal Novo Boleto */}
      {isBoletoModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddBoleto} className="bg-[#1a1d23] border border-slate-800 w-full max-w-md rounded-3xl overflow-hidden">
            <header className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-xl font-bold">Novo Boleto</h3>
              <button type="button" onClick={() => setIsBoletoModalOpen(false)}><X/></button>
            </header>
            <div className="p-6 space-y-4">
              <input 
                required 
                placeholder="Nome do pagamento"
                value={newBoleto.nome}
                onChange={e => setNewBoleto({...newBoleto, nome: e.target.value})}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <div className="flex gap-4">
                <input 
                  required 
                  type="number" 
                  step="0.01"
                  placeholder="Valor (R$)"
                  value={newBoleto.valor}
                  onChange={e => setNewBoleto({...newBoleto, valor: e.target.value})}
                  className="w-1/2 bg-slate-900 border border-slate-800 rounded-xl p-3 outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <input 
                  required 
                  type="date"
                  value={newBoleto.vencimento}
                  onChange={e => setNewBoleto({...newBoleto, vencimento: e.target.value})}
                  className="w-1/2 bg-slate-900 border border-slate-800 rounded-xl p-3 outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <select 
                required
                value={newBoleto.entidadeId}
                onChange={e => setNewBoleto({...newBoleto, entidadeId: e.target.value})}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Selecione a Entidade</option>
                {data.entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <div className="flex items-center gap-6 p-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={newBoleto.repetir} onChange={e => setNewBoleto({...newBoleto, repetir: e.target.checked})} className="accent-emerald-500" />
                  <span className="text-sm">Repetir Mensalmente</span>
                </label>
              </div>
            </div>
            <footer className="p-6 bg-slate-900/50 flex gap-3">
              <button type="button" onClick={() => setIsBoletoModalOpen(false)} className="flex-1 py-3 rounded-xl border border-slate-800 hover:bg-slate-800 transition-colors">Cancelar</button>
              <button type="submit" className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all">Salvar</button>
            </footer>
          </form>
        </div>
      )}

      {/* 3. Modal Nova Entidade */}
      {isEntityModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1d23] border border-slate-800 w-full max-w-sm rounded-3xl p-6">
            <h3 className="text-xl font-bold mb-4 text-white">Adicionar Entidade</h3>
            <input 
              id="entName"
              placeholder="Nome da Empresa (ex: Matriz)"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 outline-none focus:ring-1 focus:ring-emerald-500 mb-4"
            />
            <div className="flex gap-2">
              <button 
                onClick={() => setIsEntityModalOpen(false)}
                className="flex-1 py-2 rounded-xl border border-slate-800"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  const name = document.getElementById('entName').value;
                  if (!name) return;
                  const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
                  const color = colors[data.entities.length % colors.length];
                  setData(prev => ({
                    ...prev,
                    entities: [...prev.entities, { id: crypto.randomUUID(), name, active: true, color }]
                  }));
                  setIsEntityModalOpen(false);
                }}
                className="flex-1 py-2 rounded-xl bg-emerald-600 text-white font-bold"
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #334155; }
      `}</style>

    </div>
  );
};

export default App;