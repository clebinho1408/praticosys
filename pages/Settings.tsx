
import React, { useEffect, useState, useRef } from 'react';
import { api } from '../services/mockData';
import { SystemSettings } from '../types';
import { Save, Settings as SettingsIcon, CheckCircle, ImageIcon, Upload, Trash2, Layout, Sliders, MessageSquare, MapPin, Link as LinkIcon, Info } from 'lucide-react';

type TabType = 'GENERAL' | 'RULES' | 'COMMUNICATION';

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('GENERAL');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getSettings().then(data => {
      setSettings(data);
      setLoading(false);
    });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!settings) return;
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setSettings({
      ...settings,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && settings) {
          if (file.size > 2 * 1024 * 1024) {
              alert("A imagem é muito grande. Por favor, escolha uma imagem menor que 2MB.");
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
           <button type="button" onClick={() => setActiveTab('COMMUNICATION')} className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-colors ${activeTab === 'COMMUNICATION' ? 'bg-white border-t-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}><MessageSquare className="h-4 w-4" /> COMUNICAÇÃO</button>
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

            {activeTab === 'COMMUNICATION' && (
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
                                <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                                    <LinkIcon className="h-3 w-3" /> Link do Google Maps
                                </label>
                                <input 
                                    type="text" 
                                    name="defaultExamAddressLink" 
                                    value={settings.defaultExamAddressLink || ''} 
                                    onChange={handleChange} 
                                    placeholder="Ex: https://goo.gl/maps/..."
                                    className="w-full border p-2 rounded bg-white text-gray-900" 
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-green-600" /> Modelo de Mensagem WhatsApp
                        </h3>
                        <div>
                            <textarea 
                                name="whatsappMessageTemplate" 
                                rows={6} 
                                value={settings.whatsappMessageTemplate} 
                                onChange={handleChange} 
                                className="w-full border p-3 rounded-lg bg-white text-gray-900 font-medium" 
                            />
                            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                                <h4 className="text-xs font-black text-blue-800 uppercase mb-2 flex items-center gap-1">
                                    <Info className="h-3 w-3" /> Tags de Dados e Emojis Seguros
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {[
                                        { tag: '{CANDIDATO}', desc: 'Nome do aluno' },
                                        { tag: '{DATA}', desc: 'Data da prova' },
                                        { tag: '{HORA}', desc: 'Hora da prova' },
                                        { tag: '{AGENCIA}', desc: 'Nome da Agência' },
                                        { tag: '[WAVE]', desc: 'Emoji 👋' },
                                        { tag: '[SMILE]', desc: 'Emoji 😊' },
                                        { tag: '[CAR]', desc: 'Emoji 🚗' },
                                        { tag: '[CALENDAR]', desc: 'Emoji 📅' },
                                        { tag: '[CLOCK]', desc: 'Emoji ⏰' },
                                        { tag: '[MAP]', desc: 'Emoji 📍' },
                                        { tag: '[WARNING]', desc: 'Emoji ⚠️' },
                                        { tag: '[ID_CARD]', desc: 'Emoji 🪪' },
                                        { tag: '[CHECK]', desc: 'Emoji ✅' },
                                    ].map(item => (
                                        <div key={item.tag} className="flex flex-col">
                                            <code className="text-[10px] font-black text-blue-600">{item.tag}</code>
                                            <span className="text-[10px] text-gray-500">{item.desc}</span>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[10px] text-blue-700 mt-4 font-bold">
                                    * Use os códigos [ENTRE_COLCHETES] para garantir que os emojis apareçam corretamente no WhatsApp.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>

        <div className="bg-gray-50 p-6 border-t flex justify-end">
          <button type="submit" disabled={saving} className="flex items-center px-8 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-bold disabled:opacity-50 shadow-md transition-all">
            {saving ? 'Salvando...' : 'Salvar Alterações'} <Save className="w-4 h-4 ml-2" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default Settings;
