
import React, { useEffect, useState, useRef } from 'react';
import { api } from '../services/mockData';
import { SystemSettings } from '../types';
import { Save, Settings as SettingsIcon, CheckCircle, ImageIcon, Upload, Trash2, Layout, Sliders, MessageSquare } from 'lucide-react';

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
                            <label className="block text-sm font-medium text-gray-700">Endereço da Agência</label>
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
                        <div><label className="block text-sm font-medium">Vagas Moto Padrão</label><input type="number" name="defaultMaxSlotsA" value={settings.defaultMaxSlotsA} onChange={handleChange} className="mt-1 block w-full border p-2 rounded bg-white" /></div>
                        <div><label className="block text-sm font-medium">Vagas Carro Padrão</label><input type="number" name="defaultMaxSlotsB" value={settings.defaultMaxSlotsB} onChange={handleChange} className="mt-1 block w-full border p-2 rounded bg-white" /></div>
                    </div>
                </div>
            )}

            {activeTab === 'COMMUNICATION' && (
                <div className="space-y-6 animate-fadeIn">
                    <label className="block font-medium text-gray-700">Modelo WhatsApp</label>
                    <textarea name="whatsappMessageTemplate" rows={5} value={settings.whatsappMessageTemplate} onChange={handleChange} className="w-full border p-2 rounded bg-white text-gray-900" />
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
