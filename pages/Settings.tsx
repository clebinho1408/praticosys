import React, { useEffect, useState, useRef } from 'react';
import { api } from '../services/mockData';
import { SystemSettings } from '../types';
import { Save, Settings as SettingsIcon, Bell, Calendar, Shield, AlertTriangle, CheckCircle, MessageCircle, MapPin, Image as ImageIcon, Upload, Trash2, Layout, Sliders, MessageSquare } from 'lucide-react';

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
    // Handle checkbox separately since HTMLTextAreaElement doesn't have 'checked' property
    const checked = (e.target as HTMLInputElement).checked;

    setSettings({
      ...settings,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && settings) {
          // Limit file size to 2MB to prevent localStorage issues
          if (file.size > 2 * 1024 * 1024) {
              alert("A imagem é muito grande. Por favor, escolha uma imagem menor que 2MB.");
              return;
          }

          const reader = new FileReader();
          reader.onloadend = () => {
              setSettings({
                  ...settings,
                  logoUrl: reader.result as string
              });
          };
          reader.readAsDataURL(file);
      }
  };

  const handleRemoveLogo = () => {
      if (settings) {
          setSettings({ ...settings, logoUrl: '' });
          if (fileInputRef.current) {
              fileInputRef.current.value = '';
          }
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
      <div className="flex justify-between items-center">
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
        
        {/* TABS */}
        <div className="flex border-b border-gray-100 bg-gray-50">
           <button 
             type="button"
             onClick={() => setActiveTab('GENERAL')}
             className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'GENERAL' ? 'bg-white border-t-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
           >
              <Layout className="h-4 w-4" /> Geral
           </button>
           <button 
             type="button"
             onClick={() => setActiveTab('RULES')}
             className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'RULES' ? 'bg-white border-t-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
           >
              <Sliders className="h-4 w-4" /> Regras de Agendamento
           </button>
           <button 
             type="button"
             onClick={() => setActiveTab('COMMUNICATION')}
             className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'COMMUNICATION' ? 'bg-white border-t-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
           >
              <MessageSquare className="h-4 w-4" /> Comunicação
           </button>
        </div>

        {/* CONTENT */}
        <div className="p-8">
            {/* --- TAB: GENERAL --- */}
            {activeTab === 'GENERAL' && (
                <div className="space-y-8 animate-fadeIn">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Nome da Agência (Título do Relatório)</label>
                            <input
                                type="text"
                                name="agencyName"
                                value={settings.agencyName}
                                onChange={handleChange}
                                placeholder="Ex: DETRAN - CIRETRAN 01"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2 bg-white text-gray-900"
                            />
                        </div>

                         <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Endereço da Agência (Rodapé do Relatório)</label>
                            <input
                                type="text"
                                name="agencyAddress"
                                value={settings.agencyAddress || ''}
                                onChange={handleChange}
                                placeholder="Ex: Av. Governador Roberto Silveira, 123 - Centro"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2 bg-white text-gray-900"
                            />
                        </div>
                        
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                                <ImageIcon className="h-4 w-4" /> Logo da Agência
                            </label>
                            
                            <div className="flex items-start gap-6">
                                <div className="h-32 w-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden relative group">
                                    {settings.logoUrl ? (
                                        <img src={settings.logoUrl} alt="Logo Preview" className="h-full w-full object-contain p-2" />
                                    ) : (
                                        <span className="text-gray-400 text-xs text-center px-2">Sem Logo</span>
                                    )}
                                </div>

                                <div className="flex-1 space-y-3">
                                    <div className="flex gap-3">
                                        <label className="cursor-pointer bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                            <Upload className="h-4 w-4" />
                                            Carregar Imagem
                                            <input 
                                                ref={fileInputRef}
                                                type="file" 
                                                className="hidden" 
                                                accept="image/*"
                                                onChange={handleLogoUpload}
                                            />
                                        </label>
                                        
                                        {settings.logoUrl && (
                                            <button 
                                                type="button" 
                                                onClick={handleRemoveLogo}
                                                className="py-2 px-4 border border-red-200 rounded-md shadow-sm text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
                                            >
                                                <Trash2 className="h-4 w-4" /> Remover
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Recomendado: PNG ou JPG transparente. Tamanho máx: 2MB.<br/>
                                        Essa imagem aparecerá no cabeçalho das listas de chamada e relatórios impressos.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="col-span-2 border-t pt-6 mt-2">
                            <h3 className="font-semibold text-gray-700 flex items-center gap-2 mb-4"><MapPin className="h-5 w-5 text-red-500" /> Local de Prova Padrão (Para envio ao candidato)</h3>
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Endereço do Local de Prova</label>
                                    <input
                                        type="text"
                                        name="defaultExamAddress"
                                        placeholder="Ex: Pátio do DETRAN - Rua X, 123"
                                        value={settings.defaultExamAddress || ''}
                                        onChange={handleChange}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2 bg-white text-gray-900"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Link do Google Maps (Opcional)</label>
                                    <input
                                        type="text"
                                        name="defaultExamAddressLink"
                                        placeholder="https://maps.google.com/..."
                                        value={settings.defaultExamAddressLink || ''}
                                        onChange={handleChange}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2 bg-white text-gray-900"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- TAB: RULES --- */}
            {activeTab === 'RULES' && (
                <div className="space-y-6 animate-fadeIn">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 mb-6">
                        <p className="text-sm text-blue-800">Defina aqui os padrões para criação de novas bancas. Esses valores virão pré-preenchidos.</p>
                    </div>

                    <h4 className="text-sm font-bold text-gray-800">Padrão de Vagas por Banca</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Vagas Moto (Categoria A)</label>
                            <input
                                type="number"
                                name="defaultMaxSlotsA"
                                value={settings.defaultMaxSlotsA}
                                onChange={handleChange}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2 bg-white text-gray-900"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Vagas Carro (Categoria B)</label>
                            <input
                                type="number"
                                name="defaultMaxSlotsB"
                                value={settings.defaultMaxSlotsB}
                                onChange={handleChange}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2 bg-white text-gray-900"
                            />
                        </div>
                    </div>
                    
                    <div className="border-t pt-6 mt-6">
                        <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-100">
                            <div>
                                <label className="font-bold text-red-900">Modo de Manutenção</label>
                                <p className="text-sm text-red-700">Bloqueia o acesso ao sistema para manutenção.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" name="maintenanceMode" checked={settings.maintenanceMode} onChange={handleChange} className="sr-only peer" />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {/* --- TAB: COMMUNICATION --- */}
            {activeTab === 'COMMUNICATION' && (
                <div className="space-y-6 animate-fadeIn">
                     <div>
                        <div className="flex items-center gap-2 mb-2">
                            <MessageCircle className="h-4 w-4 text-green-600" />
                            <label className="font-medium text-gray-700">Modelo de Mensagem (WhatsApp)</label>
                        </div>
                        <textarea 
                            name="whatsappMessageTemplate"
                            rows={4}
                            value={settings.whatsappMessageTemplate}
                            onChange={handleChange}
                            placeholder="Olá {CANDIDATO}, sua prova está marcada..."
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2 bg-white text-gray-900"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                            Variáveis disponíveis: 
                            <span className="font-mono bg-gray-100 px-1 mx-1 text-blue-600">{`{CANDIDATO}`}</span> 
                            <span className="font-mono bg-gray-100 px-1 mx-1 text-blue-600">{`{DATA}`}</span> 
                            <span className="font-mono bg-gray-100 px-1 mx-1 text-blue-600">{`{HORA}`}</span> 
                            <span className="font-mono bg-gray-100 px-1 mx-1 text-blue-600">{`{CATEGORIA}`}</span> 
                            <span className="font-mono bg-gray-100 px-1 mx-1 text-blue-600">{`{ENDERECO}`}</span>
                        </p>
                    </div>
                </div>
            )}
        </div>

        {/* FOOTER */}
        <div className="bg-gray-50 p-6 border-t border-gray-100 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center px-8 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium shadow-sm disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar Alterações'} <Save className="w-4 h-4 ml-2" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default Settings;