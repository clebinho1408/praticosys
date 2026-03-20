
import React, { useEffect, useState, useRef } from 'react';
import { api } from '../services/api';
import { SystemSettings, City } from '../types';
import { Save, Settings as SettingsIcon, CheckCircle, ImageIcon, Upload, Trash2, Layout, Sliders, MessageSquare, MapPin, Link as LinkIcon, AlertOctagon } from 'lucide-react';
import { AlertModal } from '../components/CustomModals';

type TabType = 'GENERAL' | 'RULES' | 'RESTRICTIONS' | 'CNH_BRASIL' | 'PROVA_PRATICA_CFC';

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [newRestriction, setNewRestriction] = useState({ code: '', description: '' });
  const [editingRestriction, setEditingRestriction] = useState<{ code: string, description: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('GENERAL');
  const [activeSubTabCFC, setActiveSubTabCFC] = useState<'CITIES' | 'COMMUNICATION'>('CITIES');
  const [activeSubTabCNH, setActiveSubTabCNH] = useState<'COMMUNICATION'>('COMMUNICATION');
  const [cities, setCities] = useState<City[]>([]);
  const [newCityName, setNewCityName] = useState('');
  const [editingCity, setEditingCity] = useState<City | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; title: string; message: string; type?: 'error' | 'success' | 'info' }>({
    isOpen: false,
    title: '',
    message: '',
  });

  useEffect(() => {
    loadSettings();
    loadCities();
  }, []);

  const loadSettings = () => {
    api.getSettings().then(data => {
      setSettings(data);
      setLoading(false);
    });
  };

  const loadCities = () => {
    api.getCities().then(setCities);
  };

  const removeAccents = (str: string) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  const handleCityNameChange = (val: string) => {
    const transformed = removeAccents(val.toUpperCase()).replace(/[^A-Z\s]/g, '');
    if (editingCity) {
      setEditingCity({ ...editingCity, name: transformed });
    } else {
      setNewCityName(transformed);
    }
  };

  const handleAddCity = async () => {
    if (!newCityName.trim()) return;
    try {
      await api.createCity({ name: newCityName });
      setNewCityName('');
      loadCities();
      setSuccessMsg('Cidade adicionada com sucesso!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdateCity = async () => {
    if (!editingCity || !editingCity.name.trim()) return;
    try {
      await api.updateCity(editingCity.id, { name: editingCity.name });
      setEditingCity(null);
      loadCities();
      setSuccessMsg('Cidade atualizada com sucesso!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteCity = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover esta cidade?')) return;
    try {
      await api.deleteCity(id);
      loadCities();
      setSuccessMsg('Cidade removida com sucesso!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      console.error(error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!settings) return;
    const { name, value } = e.target;
    
    setSettings({
      ...settings,
      [name]: value
    });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && settings) {
          if (file.size > 2 * 1024 * 1024) {
              setAlertConfig({
                isOpen: true,
                title: 'Arquivo muito grande',
                message: 'A imagem selecionada excede o limite de 2MB. Por favor, escolha uma imagem menor.',
                type: 'error'
              });
              return;
          }
          const reader = new FileReader();
          reader.onloadend = () => {
              setSettings({ ...settings, logoUrl: reader.result as string });
          };
          reader.readAsDataURL(file);
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    await api.updateSettings(settings);
    setSaving(false);
    setSuccessMsg('Configurações salvas com sucesso!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const addRestriction = () => {
    if (!settings) return;
    
    if (editingRestriction) {
        // Update existing
        setSettings({
            ...settings,
            restrictions: settings.restrictions.map(r => r.code === editingRestriction.code ? editingRestriction : r)
        });
        setEditingRestriction(null);
    } else {
        // Add new
        if (!/^[A-Z]$/.test(newRestriction.code)) {
            alert("O campo 'Restrição' deve conter apenas uma letra maiúscula.");
            return;
        }
        setSettings({
            ...settings,
            restrictions: [...(settings.restrictions || []), newRestriction]
        });
        setNewRestriction({ code: '', description: '' });
    }
  };

  const startEditRestriction = (r: { code: string, description: string }) => {
    setEditingRestriction(r);
  };

  const removeRestriction = (code: string) => {
    if (!settings) return;
    setSettings({
        ...settings,
        restrictions: settings.restrictions.filter(r => r.code !== code)
    });
  };

  if (loading || !settings) {
    return <div className="p-8 text-center text-gray-500">Carregando configurações...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <SettingsIcon className="h-6 w-6 text-gray-600" />
          Configurações do Sistema
        </h2>
      </div>

      {successMsg && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded shadow-sm flex items-center animate-fadeIn">
          <CheckCircle className="h-5 w-5 mr-2" />
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-100 bg-gray-50 flex-wrap">
           <button type="button" onClick={() => setActiveTab('GENERAL')} className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-colors ${activeTab === 'GENERAL' ? 'bg-white border-t-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}><Layout className="h-4 w-4" /> GERAL</button>
           <button type="button" onClick={() => setActiveTab('RULES')} className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-colors ${activeTab === 'RULES' ? 'bg-white border-t-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}><Sliders className="h-4 w-4" /> REGRAS</button>
           <button type="button" onClick={() => setActiveTab('RESTRICTIONS')} className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-colors ${activeTab === 'RESTRICTIONS' ? 'bg-white border-t-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}><AlertOctagon className="h-4 w-4" /> RESTRIÇÕES</button>
           <button type="button" onClick={() => setActiveTab('CNH_BRASIL')} className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-colors ${activeTab === 'CNH_BRASIL' ? 'bg-white border-t-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}><Layout className="h-4 w-4" /> CNH DO BRASIL</button>
           <button type="button" onClick={() => setActiveTab('PROVA_PRATICA_CFC')} className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-colors ${activeTab === 'PROVA_PRATICA_CFC' ? 'bg-white border-t-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}><Layout className="h-4 w-4" /> PROVA PRÁTICA CFC</button>
        </div>

        <div className="p-8">
            {activeTab === 'GENERAL' && (
                <div className="space-y-8 animate-fadeIn">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Nome da Agência</label>
                            <input type="text" name="agencyName" value={settings.agencyName} onChange={handleChange} className="mt-1 block w-full rounded-md border p-2 bg-white text-gray-900" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Endereço da Agência (Rodapé Relatórios)</label>
                            <input type="text" name="agencyAddress" value={settings.agencyAddress || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border p-2 bg-white text-gray-900" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 flex items-center gap-2 mb-2"><ImageIcon className="h-4 w-4" /> Logo</label>
                            <div className="flex items-start gap-6">
                                <div className="h-32 w-32 border-2 border-dashed rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden">{settings.logoUrl ? <img src={settings.logoUrl} className="h-full w-full object-contain p-2" /> : <span className="text-gray-400 text-xs">Sem Logo</span>}</div>
                                <div className="flex-1 space-y-3">
                                    <div className="flex gap-3">
                                        <label className="cursor-pointer bg-white py-2 px-4 border rounded-md shadow-sm text-sm font-medium flex items-center gap-2"><Upload className="h-4 w-4" /> Carregar <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} /></label>
                                        {settings.logoUrl && <button type="button" onClick={() => setSettings({...settings, logoUrl: ''})} className="py-2 px-4 border border-red-200 rounded-md text-red-600 flex items-center gap-2"><Trash2 className="h-4 w-4" /> Remover</button>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'RULES' && (
                <div className="space-y-6 animate-fadeIn">
                    <div className="grid grid-cols-2 gap-6 text-gray-900">
                        <div><label className="block text-sm font-medium">Vagas Moto Padrão (Cat. A)</label><input type="number" name="defaultMaxSlotsA" value={settings.defaultMaxSlotsA} onChange={handleChange} className="mt-1 block w-full border p-2 rounded bg-white" /></div>
                        <div><label className="block text-sm font-medium">Vagas Carro Padrão (Cat. B)</label><input type="number" name="defaultMaxSlotsB" value={settings.defaultMaxSlotsB} onChange={handleChange} className="mt-1 block w-full border p-2 rounded bg-white" /></div>
                    </div>
                </div>
            )}

            {activeTab === 'RESTRICTIONS' && (
                <div className="space-y-6 animate-fadeIn">
                    <div className="flex gap-4">
                        <input type="text" maxLength={1} placeholder="Restrição (ex: A)" value={editingRestriction ? editingRestriction.code : newRestriction.code} onChange={e => editingRestriction ? setEditingRestriction({...editingRestriction, code: e.target.value.toUpperCase()}) : setNewRestriction({...newRestriction, code: e.target.value.toUpperCase()})} className="w-20 rounded-md border p-2 bg-white text-gray-900 uppercase" disabled={!!editingRestriction} />
                        <input type="text" placeholder="Descrição" value={editingRestriction ? editingRestriction.description : newRestriction.description} onChange={e => editingRestriction ? setEditingRestriction({...editingRestriction, description: e.target.value}) : setNewRestriction({...newRestriction, description: e.target.value})} className="flex-1 rounded-md border p-2 bg-white text-gray-900" />
                        <button type="button" onClick={addRestriction} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">{editingRestriction ? 'Atualizar' : 'Adicionar'}</button>
                        {editingRestriction && <button type="button" onClick={() => setEditingRestriction(null)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300">Cancelar</button>}
                    </div>
                    <div className="space-y-2">
                        {/* Listagem de restrições */}
                        {settings.restrictions?.map(r => (
                            <div key={r.code} className="flex items-center p-3 bg-gray-50 rounded-md border gap-4">
                                <span className="font-bold w-8 text-center shrink-0">{r.code}</span>
                                <span className="text-sm flex-1">{r.description}</span>
                                <div className="flex gap-2 shrink-0">
                                    <button type="button" onClick={() => startEditRestriction(r)} className="text-blue-500 hover:text-blue-700">Editar</button>
                                    <button type="button" onClick={() => removeRestriction(r.code)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {activeTab === 'CNH_BRASIL' && (
                <div className="space-y-6 animate-fadeIn">
                    <div className="flex border-b border-gray-100 mb-6">
                        <button type="button" onClick={() => setActiveSubTabCNH('COMMUNICATION')} className={`px-4 py-2 text-sm font-bold transition-colors ${activeSubTabCNH === 'COMMUNICATION' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>COMUNICAÇÃO</button>
                    </div>
                    
                    {activeSubTabCNH === 'COMMUNICATION' && (
                        <div className="space-y-8 animate-fadeIn">
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-blue-600" /> Endereço Padrão do Exame
                                </h3>
                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Endereço Completo</label>
                                        <input 
                                            type="text" 
                                            name="defaultExamAddress" 
                                            value={settings.defaultExamAddress || ''} 
                                            onChange={handleChange} 
                                            placeholder="Ex: Av. Principal, 123 - Centro"
                                            className="w-full border p-2 rounded bg-white text-gray-900" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Localização (Link Google Maps)</label>
                                        <div className="relative">
                                            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                            <input 
                                                type="text" 
                                                name="defaultExamAddressLink" 
                                                value={settings.defaultExamAddressLink || ''} 
                                                onChange={handleChange} 
                                                placeholder="Ex: https://maps.app.goo.gl/..."
                                                className="w-full border p-2 pl-10 rounded bg-white text-gray-900" 
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                        <MessageSquare className="h-4 w-4 text-green-600" /> Modelo de Mensagem WhatsApp
                                    </h3>
                                </div>
                                <div>
                                    <textarea 
                                        name="whatsappMessageTemplate" 
                                        rows={8} 
                                        value={settings.whatsappMessageTemplate} 
                                        onChange={handleChange} 
                                        className="w-full border p-3 rounded-lg bg-white text-gray-900 font-medium text-sm leading-relaxed" 
                                    />
                                    <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {[
                                                { tag: '{CANDIDATO}', desc: 'Nome' },
                                                { tag: '{CATEGORIA}', desc: 'Categoria' },
                                                { tag: '{DATA}', desc: 'Data' },
                                                { tag: '{HORA}', desc: 'Hora' },
                                                { tag: '{AGENCIA}', desc: 'Agência' },
                                                { tag: '{ENDERECO}', desc: 'Local' },
                                                { tag: '{LOCALIZACAO}', desc: 'Link Maps' },
                                                { tag: '{RESTRICOES}', desc: 'Restrições CNH' }
                                            ].map(item => (
                                                <div key={item.tag} className="flex flex-col bg-white p-1.5 rounded border border-blue-100 cursor-pointer hover:bg-blue-50" onClick={() => navigator.clipboard.writeText(item.tag)}>
                                                    <code className="text-[10px] font-black text-blue-600">{item.tag}</code>
                                                    <span className="text-[9px] text-gray-500 uppercase">{item.desc}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'PROVA_PRATICA_CFC' && (
                <div className="space-y-6 animate-fadeIn">
                    <div className="flex border-b border-gray-100 mb-6">
                        <button type="button" onClick={() => setActiveSubTabCFC('CITIES')} className={`px-4 py-2 text-sm font-bold transition-colors ${activeSubTabCFC === 'CITIES' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>CIDADES</button>
                        <button type="button" onClick={() => setActiveSubTabCFC('COMMUNICATION')} className={`px-4 py-2 text-sm font-bold transition-colors ${activeSubTabCFC === 'COMMUNICATION' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>COMUNICAÇÃO</button>
                    </div>

                    {activeSubTabCFC === 'CITIES' && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="flex gap-4">
                                <input 
                                    type="text" 
                                    placeholder="Nome da Cidade (MAIÚSCULA E SEM ACENTO)" 
                                    value={editingCity ? editingCity.name : newCityName} 
                                    onChange={e => handleCityNameChange(e.target.value)} 
                                    className="flex-1 rounded-md border p-2 bg-white text-gray-900 uppercase" 
                                />
                                <button 
                                    type="button" 
                                    onClick={editingCity ? handleUpdateCity : handleAddCity} 
                                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-bold"
                                >
                                    {editingCity ? 'Atualizar' : 'Adicionar'}
                                </button>
                                {editingCity && (
                                    <button 
                                        type="button" 
                                        onClick={() => setEditingCity(null)} 
                                        className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
                                    >
                                        Cancelar
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {cities.map(city => (
                                    <div key={city.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 group">
                                        <span className="font-bold text-gray-700">{city.name}</span>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                type="button" 
                                                onClick={() => setEditingCity(city)} 
                                                className="text-blue-600 hover:text-blue-800 text-sm font-bold"
                                            >
                                                Editar
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={() => handleDeleteCity(city.id)} 
                                                className="text-red-600 hover:text-red-800"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {cities.length === 0 && (
                                    <div className="col-span-full py-8 text-center text-gray-400 bg-gray-50 rounded-lg border border-dashed">
                                        Nenhuma cidade cadastrada.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeSubTabCFC === 'COMMUNICATION' && (
                        <div className="space-y-8 animate-fadeIn">
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                        <MessageSquare className="h-4 w-4 text-green-600" /> Modelo de Mensagem WhatsApp (CFC)
                                    </h3>
                                </div>
                                <div>
                                    <textarea 
                                        name="cfcWhatsappMessageTemplate" 
                                        rows={8} 
                                        value={settings.cfcWhatsappMessageTemplate || ''} 
                                        onChange={handleChange} 
                                        className="w-full border p-3 rounded-lg bg-white text-gray-900 font-medium text-sm leading-relaxed" 
                                    />
                                    <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {[
                                                { tag: '{AUTOESCOLA}', desc: 'Autoescola' },
                                                { tag: '{DATA}', desc: 'Data' },
                                                { tag: '{HORARIO}', desc: 'Horário' },
                                                { tag: '{EXAMINADOR}', desc: 'Examinador' },
                                                { tag: '{EXAME}', desc: 'Exame' },
                                                { tag: '{TIPO}', desc: 'Tipo' }
                                            ].map(item => (
                                                <div key={item.tag} className="flex flex-col bg-white p-1.5 rounded border border-blue-100 cursor-pointer hover:bg-blue-50" onClick={() => navigator.clipboard.writeText(item.tag)}>
                                                    <code className="text-[10px] font-black text-blue-600">{item.tag}</code>
                                                    <span className="text-[9px] text-gray-500 uppercase">{item.desc}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>

        <div className="bg-gray-50 p-6 border-t flex justify-end">
          <button type="submit" disabled={saving} className="flex items-center px-8 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-bold disabled:opacity-50 shadow-md transition-all">
            {saving ? 'Salvando...' : 'Salvar Configurações'} <Save className="w-4 h-4 ml-2" />
          </button>
        </div>
      </form>

      <AlertModal 
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
      />
    </div>
  );
};

export default Settings;
