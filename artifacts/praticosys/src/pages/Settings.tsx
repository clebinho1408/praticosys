
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { api } from '../services/api';
import { SystemSettings, City, ExamLocation, Examiner, BlockedDate, UserRole, User } from '../types';
import { Save, Settings as SettingsIcon, CheckCircle, ImageIcon, Upload, Trash2, Layout, MessageSquare, MapPin, Link as LinkIcon, AlertOctagon, Calendar, Plus, ShieldAlert, Edit2, ScrollText, RefreshCw } from 'lucide-react';
import { AlertModal, ConfirmModal } from '../components/CustomModals';
import DatePicker from '../components/DatePicker';
import { isDateInPast } from '../lib/dateBlocking';

type TabType = 'GENERAL' | 'CNH_BRASIL' | 'PROVA_PRATICA_CFC' | 'BACKUPS' | 'RISK_AREA';

const formatBytes = (bytes: number): string => {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const Settings: React.FC<{ user: User }> = ({ user }) => {
  const isConsultant = user?.role === UserRole.CONSULTANT;
  const [resetConfirmStep1, setResetConfirmStep1] = useState(false);
  const [resetConfirmStep2, setResetConfirmStep2] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [newRestriction, setNewRestriction] = useState({ code: '', description: '' });
  const [editingRestriction, setEditingRestriction] = useState<{ code: string, description: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('GENERAL');
  const [activeSubTabGeneral, setActiveSubTabGeneral] = useState<'AGENCY_DATA' | 'CITIES' | 'RESTRICTIONS' | 'BLOCKED_DATES'>('AGENCY_DATA');

  const [activeSubTabCFC, setActiveSubTabCFC] = useState<'COMMUNICATION' | 'ESCALA_PADRAO_PCD' | 'ESCALA_PADRAO_CNH_BRASIL'>('COMMUNICATION');
  const [activeSubTabCNH, setActiveSubTabCNH] = useState<'COMMUNICATION' | 'LOCAIS' | 'LOGS'>('LOCAIS');
  const [cnhLogs, setCnhLogs] = useState<any[]>([]);
  const [cnhLogsLoading, setCnhLogsLoading] = useState(false);
  const [riskKeyInput, setRiskKeyInput] = useState('');
  const [riskKeyVerified, setRiskKeyVerified] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [examiners, setExaminers] = useState<Examiner[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [newBlockedDate, setNewBlockedDate] = useState({ date: '', description: '' });
  const [newCityName, setNewCityName] = useState('');
  const [editingCity, setEditingCity] = useState<City | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Exam Locations state
  const [examLocations, setExamLocations] = useState<ExamLocation[]>([]);
  const [locationForm, setLocationForm] = useState({ cityId: '', address: '', mapsUrl: '', regionsServed: [] as string[] });
  const [editingLocation, setEditingLocation] = useState<ExamLocation | null>(null);

  // Backups state
  const isAdmin = user?.role === UserRole.ADMIN;
  const [backups, setBackups] = useState<any[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [downloadingBackupId, setDownloadingBackupId] = useState<string | null>(null);

  const loadBackups = async () => {
    setBackupsLoading(true);
    try {
      const data = await api.getBackups();
      setBackups(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading backups:', err);
    } finally {
      setBackupsLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    try {
      await api.createBackup();
      await loadBackups();
      setAlertConfig({ isOpen: true, title: 'Backup criado', message: 'O backup foi criado com sucesso.', type: 'success' });
    } catch (err: any) {
      setAlertConfig({ isOpen: true, title: 'Erro', message: 'Não foi possível criar o backup. Tente novamente.', type: 'error' });
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleDownloadBackup = async (backup: any) => {
    setDownloadingBackupId(backup.id);
    try {
      const full = await api.getBackupPayload(backup.id);
      const payload = full?.payload ?? full;
      const dateStr = new Date(backup.created_at || backup.createdAt || Date.now()).toISOString().slice(0, 10);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-praticosys-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setAlertConfig({ isOpen: true, title: 'Erro', message: 'Não foi possível baixar o backup.', type: 'error' });
    } finally {
      setDownloadingBackupId(null);
    }
  };

  useEffect(() => {
    if (activeTab === 'BACKUPS' && isAdmin) loadBackups();
  }, [activeTab]);

  const loadCnhLogs = async () => {
    setCnhLogsLoading(true);
    try {
      const data = await api.getCnhLogs();
      setCnhLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading CNH logs:', err);
    } finally {
      setCnhLogsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'CNH_BRASIL' && activeSubTabCNH === 'LOGS') loadCnhLogs();
  }, [activeTab, activeSubTabCNH]);

  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; title: string; message: string; type?: 'error' | 'success' | 'info' }>({
    isOpen: false,
    title: '',
    message: '',
  });

  useEffect(() => {
    loadSettings();
    loadCities();
    loadExaminers();
    loadBlockedDates();
    loadExamLocations();
  }, []);

  const loadExamLocations = async () => {
    try {
      const data = await api.getExamLocations();
      setExamLocations(data);
    } catch (err) {
      console.error('Error loading exam locations:', err);
    }
  };

  const handleSaveLocation = async () => {
    const form = editingLocation
      ? { cityId: editingLocation.cityId, address: editingLocation.address, mapsUrl: editingLocation.mapsUrl, regionsServed: editingLocation.regionsServed || [] }
      : locationForm;
    if (!form.cityId) return;
    try {
      if (editingLocation) {
        await api.updateExamLocation(editingLocation.id, form);
        setEditingLocation(null);
      } else {
        await api.createExamLocation(form);
        setLocationForm({ cityId: '', address: '', mapsUrl: '', regionsServed: [] });
      }
      await loadExamLocations();
      setSuccessMsg('Local salvo com sucesso!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) { console.error(err); }
  };

  const handleDeleteLocation = async (id: string) => {
    if (!confirm('Deseja remover este local de prova?')) return;
    try {
      await api.deleteExamLocation(id);
      await loadExamLocations();
      setSuccessMsg('Local removido!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) { console.error(err); }
  };

  const loadBlockedDates = async () => {
    try {
      const data = await api.getBlockedDates();
      setBlockedDates(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error loading blocked dates:", error);
    }
  };

  const loadSettings = () => {
    api.getSettings().then(data => {
      if (data && (!data.pcdExamName || data.pcdExamName === 'Prova Prática PCD' || data.pcdExamName === 'PROVA DIRECTAO PCD' || data.pcdExamName === 'PROVA DIREÇÃO PCD' || data.pcdExamName === 'Prova Direção PCD')) {
        data.pcdExamName = 'PROVA DIRECAO PCD';
      }
      if (data && !data.cnhBrasilMainSchedule) {
        data.cnhBrasilMainSchedule = {
          active: false,
          frequency: '1_WEEK',
          days: [],
          slots: []
        };
      }
      setSettings(data);
      setLoading(false);
    }).catch(err => {
      console.error("Error loading settings:", err);
      setLoading(false);
    });
  };

  const loadCities = () => {
    api.getCities().then(setCities);
  };

  const loadExaminers = () => {
    api.getExaminers().then(setExaminers);
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

  const handleAddBlockedDate = async () => {
    if (!newBlockedDate.date || !newBlockedDate.description) return;
    if (isDateInPast(newBlockedDate.date)) {
      alert('Não é permitido cadastrar um bloqueio em uma data passada.');
      return;
    }
    try {
      await api.createBlockedDate(newBlockedDate);
      setNewBlockedDate({ date: '', description: '' });
      await loadBlockedDates();
      setSuccessMsg('Data bloqueada com sucesso!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      console.error("Error blocking date:", error);
      alert(error instanceof Error ? error.message : 'Erro ao bloquear data');
    }
  };

  const handleDeleteBlockedDate = async (id: string) => {
    if (!confirm('Deseja remover este bloqueio?')) return;
    try {
      await api.deleteBlockedDate(id);
      await loadBlockedDates();
      setSuccessMsg('Bloqueio removido!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      console.error("Error removing blocked date:", error);
      alert(error instanceof Error ? error.message : 'Erro ao remover bloqueio');
    }
  };

  const handleAutoPopulateHolidays = async () => {
    const year = new Date().getFullYear();
    const holidays = [
      { date: `${year}-01-01`, description: 'Confraternização Universal' },
      { date: `${year}-04-21`, description: 'Tiradentes' },
      { date: `${year}-05-01`, description: 'Dia do Trabalho' },
      { date: `${year}-09-07`, description: 'Independência do Brasil' },
      { date: `${year}-10-12`, description: 'Nossa Senhora Aparecida' },
      { date: `${year}-11-02`, description: 'Finados' },
      { date: `${year}-11-15`, description: 'Proclamação da República' },
      { date: `${year}-11-20`, description: 'Consciência Negra' },
      { date: `${year}-12-25`, description: 'Natal' },
    ];

    // Filter only weekdays
    const weekdayHolidays = holidays.filter(h => {
      const d = new Date(h.date + 'T00:00:00');
      const day = d.getDay();
      return day !== 0 && day !== 6; // Not Sunday (0) or Saturday (6)
    });

    const existingDates = new Set(blockedDates.map(blockedDate => blockedDate.date));
    const holidaysToCreate = weekdayHolidays.filter(holiday => !existingDates.has(holiday.date));

    if (holidaysToCreate.length === 0) {
      setAlertConfig({
        isOpen: true,
        title: 'Feriados já cadastrados',
        message: `Os feriados de ${year} em dias de semana já estão cadastrados.`,
        type: 'info'
      });
      return;
    }

    setSaving(true);
    try {
      const failedDates: string[] = [];
      for (const holiday of holidaysToCreate) {
        try {
          await api.createBlockedDate({ ...holiday, isHoliday: true });
        } catch (error) {
          console.error(`Error adding holiday ${holiday.date}:`, error);
          failedDates.push(holiday.description);
        }
      }
      await loadBlockedDates();

      if (failedDates.length > 0) {
        throw new Error(`Não foi possível cadastrar: ${failedDates.join(', ')}.`);
      }

      setAlertConfig({
        isOpen: true,
        title: 'Sucesso',
        message: `${holidaysToCreate.length} feriado(s) nacional(is) em dias de semana foram adicionados.`,
        type: 'success'
      });
    } catch (error) {
      console.error(error);
      setAlertConfig({
        isOpen: true,
        title: 'Cadastro incompleto',
        message: error instanceof Error ? error.message : 'Não foi possível cadastrar todos os feriados.',
        type: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!settings) return;
    const { name, value, type } = e.target;
    
    let finalValue: any = value;
    if (name === 'pcdExamName') {
      finalValue = value.toUpperCase();
    } else if (type === 'number') {
      finalValue = parseInt(value) || 0;
    }
    
    setSettings({
      ...settings,
      [name]: finalValue
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
    try {
      await api.updateSettings(settings);
      setSuccessMsg('Configurações salvas com sucesso!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setAlertConfig({
        isOpen: true,
        title: 'Erro ao salvar',
        message: 'Ocorreu um erro ao salvar as configurações. Verifique os dados e tente novamente.',
        type: 'error'
      });
    } finally {
      setSaving(false);
    }
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

  const handleResetData = () => {
    setResetConfirmStep1(true);
  };

  const executeResetData = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/risk-area', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESET_DATA', securityKey: riskKeyInput })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erro desconhecido');
      }
      setAlertConfig({
        isOpen: true,
        title: 'Dados Resetados',
        message: 'Todos os dados operacionais foram apagados com sucesso.',
        type: 'success'
      });
    } catch (error: any) {
      console.error('Error resetting data:', error);
      setAlertConfig({
        isOpen: true,
        title: 'Erro ao resetar',
        message: `Ocorreu um erro ao tentar resetar os dados: ${error.message}`,
        type: 'error'
      });
    } finally {
      setSaving(false);
    }
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
           <button type="button" onClick={() => setActiveTab('CNH_BRASIL')} className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-colors ${activeTab === 'CNH_BRASIL' ? 'bg-white border-t-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}><Layout className="h-4 w-4" /> CNH DO BRASIL</button>
           <button type="button" onClick={() => setActiveTab('PROVA_PRATICA_CFC')} className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-colors ${activeTab === 'PROVA_PRATICA_CFC' ? 'bg-white border-t-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}><Layout className="h-4 w-4" /> PROVA PRÁTICA CFC</button>
           {isAdmin && <button type="button" onClick={() => setActiveTab('BACKUPS')} className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-colors ${activeTab === 'BACKUPS' ? 'bg-white border-t-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}><Save className="h-4 w-4" /> BACKUPS</button>}
           <button type="button" onClick={() => setActiveTab('RISK_AREA')} className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-colors ${activeTab === 'RISK_AREA' ? 'bg-white border-t-2 border-red-600 text-red-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}><AlertOctagon className="h-4 w-4" /> ÁREA DE RISCO</button>
        </div>

        <div className="p-8">
            {activeTab === 'GENERAL' && (
                <div className="space-y-8 animate-fadeIn">
                    <div className="flex border-b border-gray-100 mb-6 overflow-x-auto">
                        <button type="button" onClick={() => setActiveSubTabGeneral('AGENCY_DATA')} className={`px-4 py-2 text-sm font-bold transition-colors whitespace-nowrap ${activeSubTabGeneral === 'AGENCY_DATA' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>DADOS DA AGÊNCIA</button>
                        <button type="button" onClick={() => setActiveSubTabGeneral('CITIES')} className={`px-4 py-2 text-sm font-bold transition-colors whitespace-nowrap ${activeSubTabGeneral === 'CITIES' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>CIDADES</button>
                        <button type="button" onClick={() => setActiveSubTabGeneral('RESTRICTIONS')} className={`px-4 py-2 text-sm font-bold transition-colors whitespace-nowrap ${activeSubTabGeneral === 'RESTRICTIONS' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>RESTRIÇÕES</button>
                        <button type="button" onClick={() => setActiveSubTabGeneral('BLOCKED_DATES')} className={`px-4 py-2 text-sm font-bold transition-colors whitespace-nowrap ${activeSubTabGeneral === 'BLOCKED_DATES' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>BLOQUEIO DE DATAS</button>
                    </div>

                    {activeSubTabGeneral === 'AGENCY_DATA' && (
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
                                        {!isConsultant && (
                                            <div className="flex gap-3">
                                                <label className="cursor-pointer bg-white py-2 px-4 border rounded-md shadow-sm text-sm font-medium flex items-center gap-2"><Upload className="h-4 w-4" /> Carregar <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} /></label>
                                                {settings.logoUrl && <button type="button" onClick={() => setSettings({...settings, logoUrl: ''})} className="py-2 px-4 border border-red-200 rounded-md text-red-600 flex items-center gap-2"><Trash2 className="h-4 w-4" /> Remover</button>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSubTabGeneral === 'CITIES' && (
                        <div className="space-y-6 animate-fadeIn">
                            {!isConsultant && (
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
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {cities.map(city => (
                                    <div key={city.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 group">
                                        <span className="font-bold text-gray-700">{city.name}</span>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {!isConsultant && (
                                                <>
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
                                                </>
                                            )}
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

                    {activeSubTabGeneral === 'RESTRICTIONS' && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-start gap-3">
                                <AlertOctagon className="h-5 w-5 text-amber-600 mt-0.5" />
                                <div>
                                    <h4 className="text-sm font-bold text-amber-800">Aviso de Restrições</h4>
                                    <p className="text-xs text-amber-700 mt-1">As restrições abaixo referem-se as letras informadas em sua CNH.</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {!isConsultant && (
                                    <div className="flex gap-4">
                                        <input 
                                            type="text" 
                                            placeholder="Letra" 
                                            maxLength={1}
                                            value={editingRestriction ? editingRestriction.code : newRestriction.code} 
                                            onChange={e => editingRestriction ? setEditingRestriction({...editingRestriction, code: e.target.value.toUpperCase()}) : setNewRestriction({...newRestriction, code: e.target.value.toUpperCase()})} 
                                            className="w-24 rounded-md border p-2 bg-white text-gray-900 uppercase" 
                                        />
                                        <input 
                                            type="text" 
                                            placeholder="Descrição da Restrição" 
                                            value={editingRestriction ? editingRestriction.description : newRestriction.description} 
                                            onChange={e => editingRestriction ? setEditingRestriction({...editingRestriction, description: e.target.value}) : setNewRestriction({...newRestriction, description: e.target.value})} 
                                            className="flex-1 rounded-md border p-2 bg-white text-gray-900" 
                                        />
                                        <button 
                                            type="button" 
                                            onClick={addRestriction} 
                                            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-bold"
                                        >
                                            {editingRestriction ? 'Atualizar' : 'Adicionar'}
                                        </button>
                                        {editingRestriction && (
                                            <button 
                                                type="button" 
                                                onClick={() => setEditingRestriction(null)} 
                                                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
                                            >
                                                Cancelar
                                            </button>
                                        )}
                                    </div>
                                )}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {(settings.restrictions || []).map(r => (
                                        <div key={r.code} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 group">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-blue-600">{r.code}</span>
                                                <span className="text-xs text-gray-500">{r.description}</span>
                                            </div>
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {!isConsultant && (
                                                    <>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => startEditRestriction(r)} 
                                                            className="text-blue-600 hover:text-blue-800 text-sm font-bold"
                                                        >
                                                            Editar
                                                        </button>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => removeRestriction(r.code)} 
                                                            className="text-red-600 hover:text-red-800"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {(!settings.restrictions || settings.restrictions.length === 0) && (
                                        <div className="col-span-full py-8 text-center text-gray-400 bg-gray-50 rounded-lg border border-dashed">
                                            Nenhuma restrição cadastrada.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSubTabGeneral === 'BLOCKED_DATES' && (
                        <div className="space-y-8 animate-fadeIn">
                            <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                        <ShieldAlert className="h-5 w-5 text-red-500" /> Bloqueio Global de Finais de Semana
                                    </h3>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-xs font-bold uppercase ${settings.blockWeekends ? 'text-red-600' : 'text-gray-400'}`}>
                                            {settings.blockWeekends ? 'Bloqueado' : 'Liberado'}
                                        </span>
                                        <button 
                                            type="button"
                                            onClick={() => !isConsultant && setSettings({ ...settings, blockWeekends: !settings.blockWeekends })}
                                            disabled={isConsultant}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${settings.blockWeekends ? 'bg-red-600' : 'bg-gray-200'} ${isConsultant ? 'cursor-not-allowed opacity-50' : ''}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.blockWeekends ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500">Quando ativado, o sistema impedirá agendamentos em sábados e domingos em todos os módulos.</p>
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                        <Calendar className="h-5 w-5 text-blue-600" /> Datas Bloqueadas Manualmente
                                    </h3>
                                    {!isConsultant && (
                                        <button 
                                            type="button"
                                            onClick={handleAutoPopulateHolidays}
                                             disabled={saving}
                                            className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-md border border-blue-200 hover:bg-blue-100 font-bold flex items-center gap-2"
                                        >
                                             <Plus className="h-3 w-3" /> {saving ? 'Cadastrando...' : 'Pré-cadastrar Feriados (Dias de Semana)'}
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                                    <div className="md:col-span-1">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data</label>
                                        <DatePicker 
                                            value={newBlockedDate.date} 
                                            onChange={date => setNewBlockedDate({ ...newBlockedDate, date })} 
                                            blockedDates={blockedDates}
                                            settings={settings}
                                            placeholder="Selecione a data"
                                            className="w-full"
                                        />
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descrição</label>
                                        <input 
                                            type="text" 
                                            placeholder="Ex: Feriado Municipal"
                                            value={newBlockedDate.description}
                                            onChange={e => setNewBlockedDate({ ...newBlockedDate, description: e.target.value })}
                                            className="w-full border p-2 rounded bg-white text-gray-900"
                                        />
                                    </div>
                                    <div className="md:col-span-1 flex items-end">
                                        {!isConsultant && (
                                            <button 
                                                type="button"
                                                onClick={handleAddBlockedDate}
                                                className="w-full bg-blue-600 text-white p-2 rounded font-bold hover:bg-blue-700 transition-colors"
                                            >
                                                Bloquear Data
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-bold text-gray-600">Data</th>
                                                <th className="px-4 py-3 text-left font-bold text-gray-600">Descrição</th>
                                                <th className="px-4 py-3 text-center font-bold text-gray-600">Tipo</th>
                                                <th className="px-4 py-3 text-right font-bold text-gray-600">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {blockedDates.map(bd => (
                                                <tr key={bd.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 font-medium text-gray-900">
                                                        {new Date(bd.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-600">{bd.description}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        {bd.isHoliday ? (
                                                            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">Feriado</span>
                                                        ) : (
                                                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">Manual</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleDeleteBlockedDate(bd.id)}
                                                            className="text-red-500 hover:text-red-700 p-1"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {blockedDates.length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400 italic">Nenhuma data bloqueada.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}


            {activeTab === 'CNH_BRASIL' && (
                <div className="space-y-6 animate-fadeIn">
                    <div className="flex border-b border-gray-100 mb-6 overflow-x-auto">
                        <button type="button" onClick={() => setActiveSubTabCNH('LOCAIS')} className={`px-4 py-2 text-sm font-bold transition-colors whitespace-nowrap ${activeSubTabCNH === 'LOCAIS' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>LOCAIS</button>
                        <button type="button" onClick={() => setActiveSubTabCNH('LOGS')} className={`px-4 py-2 text-sm font-bold transition-colors whitespace-nowrap ${activeSubTabCNH === 'LOGS' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>LOGS DE REGISTRO</button>
                    </div>
                    
                    {activeSubTabCNH === 'LOCAIS' && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-blue-600" /> {editingLocation ? 'Editar Local de Prova' : 'Novo Local de Prova'}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Local Padrão (Cidade) <span className="text-red-500">*</span></label>
                                        <select
                                            className="w-full border rounded-md p-2 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                            value={editingLocation ? (editingLocation.cityId || '') : locationForm.cityId}
                                            onChange={e => editingLocation
                                                ? setEditingLocation({ ...editingLocation, cityId: e.target.value })
                                                : setLocationForm({ ...locationForm, cityId: e.target.value })}
                                        >
                                            <option value="">Selecione a cidade...</option>
                                            {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Endereço</label>
                                        <input
                                            type="text"
                                            placeholder="Ex: Av. Principal, 123 - Centro"
                                            className="w-full border rounded-md p-2 bg-white text-gray-900"
                                            value={editingLocation ? (editingLocation.address || '') : locationForm.address}
                                            onChange={e => editingLocation
                                                ? setEditingLocation({ ...editingLocation, address: e.target.value })
                                                : setLocationForm({ ...locationForm, address: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Localização (Google Maps)</label>
                                        <input
                                            type="url"
                                            placeholder="https://maps.app.goo.gl/..."
                                            className="w-full border rounded-md p-2 bg-white text-gray-900"
                                            value={editingLocation ? (editingLocation.mapsUrl || '') : locationForm.mapsUrl}
                                            onChange={e => editingLocation
                                                ? setEditingLocation({ ...editingLocation, mapsUrl: e.target.value })
                                                : setLocationForm({ ...locationForm, mapsUrl: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Regiões Atendidas (Cidades)</label>
                                        <div className="border rounded-md p-2 bg-white max-h-36 overflow-y-auto space-y-1">
                                            {cities.map(c => {
                                                const regions = editingLocation ? (editingLocation.regionsServed || []) : locationForm.regionsServed;
                                                const checked = regions.includes(c.id);
                                                return (
                                                    <label key={c.id} className={`flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-gray-50 text-sm ${checked ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => {
                                                                const next = checked ? regions.filter((id: string) => id !== c.id) : [...regions, c.id];
                                                                if (editingLocation) setEditingLocation({ ...editingLocation, regionsServed: next });
                                                                else setLocationForm({ ...locationForm, regionsServed: next });
                                                            }}
                                                            className="accent-blue-600"
                                                        />
                                                        {c.name}
                                                    </label>
                                                );
                                            })}
                                            {cities.length === 0 && <p className="text-xs text-gray-400 italic p-1">Nenhuma cidade cadastrada.</p>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-3 justify-end">
                                    {editingLocation && (
                                        <button type="button" onClick={() => setEditingLocation(null)} className="px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-100 font-medium text-sm">Cancelar</button>
                                    )}
                                    <button type="button" onClick={handleSaveLocation} className="px-4 py-2 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700 text-sm flex items-center gap-2">
                                        <Plus className="h-4 w-4" />{editingLocation ? 'Atualizar' : 'Adicionar Local'}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {examLocations.length === 0 && (
                                    <div className="py-10 text-center text-gray-400 bg-gray-50 rounded-lg border border-dashed">
                                        Nenhum local de prova cadastrado.
                                    </div>
                                )}
                                {examLocations.map(loc => {
                                    const city = cities.find(c => c.id === loc.cityId);
                                    const regionNames = (loc.regionsServed || []).map((id: string) => cities.find(c => c.id === id)?.name).filter(Boolean).join(', ');
                                    return (
                                        <div key={loc.id} className="flex items-start justify-between p-4 bg-white border border-gray-200 rounded-lg shadow-sm group">
                                            <div className="flex-1 space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="h-4 w-4 text-blue-600" />
                                                    <span className="font-bold text-gray-800">{city?.name || loc.cityId}</span>
                                                </div>
                                                {loc.address && <p className="text-xs text-gray-500 ml-6">{loc.address}</p>}
                                                {loc.mapsUrl && (
                                                    <a href={loc.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline ml-6 flex items-center gap-1">
                                                        <LinkIcon className="h-3 w-3" /> Ver no mapa
                                                    </a>
                                                )}
                                                {regionNames && (
                                                    <p className="text-xs text-gray-500 ml-6"><span className="font-medium">Regiões:</span> {regionNames}</p>
                                                )}
                                            </div>
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                                                <button type="button" onClick={() => setEditingLocation(loc)} className="text-blue-600 hover:text-blue-800 p-1"><Edit2 className="h-4 w-4" /></button>
                                                <button type="button" onClick={() => handleDeleteLocation(loc.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="h-4 w-4" /></button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {activeSubTabCNH === 'LOGS' && (
                        <div className="space-y-4 animate-fadeIn">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <ScrollText className="h-5 w-5 text-blue-600" />
                                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Logs de Registro — CNH do Brasil</h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={loadCnhLogs}
                                    disabled={cnhLogsLoading}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
                                >
                                    <RefreshCw className={`h-3.5 w-3.5 ${cnhLogsLoading ? 'animate-spin' : ''}`} />
                                    Atualizar
                                </button>
                            </div>

                            {cnhLogsLoading ? (
                                <div className="py-16 text-center text-gray-400">
                                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-400" />
                                    <p className="text-sm">Carregando registros...</p>
                                </div>
                            ) : cnhLogs.length === 0 ? (
                                <div className="py-16 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                    <ScrollText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                                    <p className="text-sm text-gray-400">Nenhum registro encontrado.</p>
                                    <p className="text-xs text-gray-400 mt-1">As ações em Candidatos e Bancas do CNH do Brasil aparecerão aqui.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200">
                                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Data / Hora</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Usuário</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">CPF</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Nome do Candidato</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Ação</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 bg-white">
                                            {cnhLogs.map((log: any) => {
                                                const details = typeof log.details === 'string' ? JSON.parse(log.details || '{}') : (log.details ?? {});
                                                const dt = log.created_at || log.createdAt;
                                                const formatted = dt ? new Date(dt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
                                                const actionColors: Record<string, string> = {
                                                    'Foi cadastrado': 'bg-green-100 text-green-700',
                                                    'Foi excluído': 'bg-red-100 text-red-700',
                                                    'Foi adicionado na Banca': 'bg-blue-100 text-blue-700',
                                                    'Foi excluído da Banca': 'bg-orange-100 text-orange-700',
                                                    'Foi modificado': 'bg-gray-100 text-gray-700',
                                                };
                                                const color = actionColors[log.action] ?? 'bg-gray-100 text-gray-600';
                                                const cpf = details.cpf ? details.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '—';
                                                return (
                                                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-mono text-xs">{formatted}</td>
                                                        <td className="px-4 py-3 text-gray-800 whitespace-nowrap">{log.user_name || log.userName || '—'}</td>
                                                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap font-mono text-xs">{cpf}</td>
                                                        <td className="px-4 py-3 text-gray-800 max-w-xs truncate">{details.name || '—'}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${color}`}>
                                                                {log.action}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            <p className="text-xs text-gray-400 text-right">Mostrando até 300 registros mais recentes</p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'PROVA_PRATICA_CFC' && (
                <div className="space-y-6 animate-fadeIn">
                    <div className="flex border-b border-gray-100 mb-6 overflow-x-auto">
                        <button type="button" onClick={() => setActiveSubTabCFC('COMMUNICATION')} className={`px-4 py-2 text-sm font-bold transition-colors whitespace-nowrap ${activeSubTabCFC === 'COMMUNICATION' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>GERAL</button>
                        <button type="button" onClick={() => setActiveSubTabCFC('ESCALA_PADRAO_PCD')} className={`px-4 py-2 text-sm font-bold transition-colors whitespace-nowrap ${activeSubTabCFC === 'ESCALA_PADRAO_PCD' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>ESCALA PADRÃO PCD</button>
                        <button type="button" onClick={() => setActiveSubTabCFC('ESCALA_PADRAO_CNH_BRASIL')} className={`px-4 py-2 text-sm font-bold transition-colors whitespace-nowrap ${activeSubTabCFC === 'ESCALA_PADRAO_CNH_BRASIL' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>ESCALA PADRÃO CNH DO BRASIL</button>
                    </div>

                    {activeSubTabCFC === 'COMMUNICATION' && (
                        <div className="space-y-8 animate-fadeIn">
                            <div className="grid grid-cols-1 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Nome do Exame PCD</label>
                                    <input 
                                        type="text" 
                                        name="pcdExamName" 
                                        value={settings.pcdExamName || ''} 
                                        onChange={(e) => {
                                            const val = e.target.value.toUpperCase();
                                            setSettings({ ...settings, pcdExamName: val });
                                        }} 
                                        placeholder="Ex: PROVA DIRECAO PCD"
                                        className="mt-1 block w-full rounded-md border p-2 bg-white text-gray-900 font-bold" 
                                    />
                                    <p className="text-[10px] text-gray-500 mt-1 uppercase">Este nome será exibido nos agendamentos e mensagens automáticas.</p>
                                </div>
                            </div>

                        </div>
                    )}

                    {activeSubTabCFC === 'ESCALA_PADRAO_PCD' && settings.pcdMainSchedule && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
                                <p className="text-sm text-blue-800">
                                    Configure aqui a escala padrão para os exames PCD. Esta escala será usada como base para os agendamentos automáticos.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center bg-gray-50 p-3 rounded border border-gray-200">
                                    <div>
                                        <h4 className="font-bold text-sm">Status da Escala PCD</h4>
                                        <p className="text-xs text-gray-500">{settings.pcdMainSchedule.active ? 'Esta escala está ATIVA' : 'Esta escala está DESATIVADA'}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSettings({
                                            ...settings,
                                            pcdMainSchedule: { ...settings.pcdMainSchedule!, active: !settings.pcdMainSchedule!.active }
                                        })}
                                        className={`px-4 py-2 rounded text-xs font-bold transition-colors ${
                                            settings.pcdMainSchedule.active 
                                                ? 'bg-red-100 text-red-600 border border-red-200 hover:bg-red-200' 
                                                : 'bg-green-100 text-green-600 border border-green-200 hover:bg-green-200'
                                        }`}
                                    >
                                        {settings.pcdMainSchedule.active ? 'DESATIVAR ESCALA' : 'ATIVAR ESCALA'}
                                    </button>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1 text-gray-700">Frequência</label>
                                    <select 
                                        className="w-full border rounded p-2 bg-white text-gray-900"
                                        value={settings.pcdMainSchedule.frequency}
                                        onChange={e => {
                                            const freq = e.target.value as any;
                                            let days = [...settings.pcdMainSchedule!.days];
                                            let slots = [...settings.pcdMainSchedule!.slots];
                                            
                                            if (freq === '1_WEEK' || freq === '2_DAY' || freq === '15_DAYS') {
                                                if (days.length > 1) days = days.length > 0 ? [days[0]] : [];
                                            } else if (freq === '2_WEEK') {
                                                if (days.length > 2) days = days.slice(0, 2);
                                            } else if (freq === '3_WEEK') {
                                                if (days.length > 3) days = days.slice(0, 3);
                                            }

                                            if (freq === '2_DAY' || freq === '2_WEEK') {
                                                if (slots.length > 2) slots = slots.slice(0, 2);
                                            } else if (freq === '3_WEEK') {
                                                if (slots.length > 3) slots = slots.slice(0, 3);
                                            } else if (freq === '1_WEEK' || freq === '15_DAYS') {
                                                if (slots.length > 1) slots = slots.slice(0, 1);
                                            }

                                            if (freq !== '2_WEEK' && freq !== '3_WEEK') {
                                                slots = slots.map(s => ({ ...s, day: '' }));
                                            }

                                            setSettings({
                                                ...settings,
                                                pcdMainSchedule: { ...settings.pcdMainSchedule!, frequency: freq, days, slots }
                                            });
                                        }}
                                    >
                                        <option value="1_WEEK">1 vez na semana</option>
                                        <option value="2_WEEK">2 vezes na semana</option>
                                        <option value="3_WEEK">3 vezes na semana</option>
                                        <option value="2_DAY">2 vezes no dia</option>
                                        <option value="15_DAYS">A cada 15 dias</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1 text-gray-700">Dias da Semana</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['SEG', 'TER', 'QUA', 'QUI', 'SEX'].map(day => (
                                            <button
                                                key={day}
                                                type="button"
                                                onClick={() => {
                                                    const current = settings.pcdMainSchedule!.days || [];
                                                    const isSelected = current.includes(day);
                                                    let newDays = [];
                                                    
                                                    if (isSelected) {
                                                        newDays = current.filter(d => d !== day);
                                                    } else {
                                                        if ((settings.pcdMainSchedule!.frequency === '1_WEEK' || settings.pcdMainSchedule!.frequency === '2_DAY' || settings.pcdMainSchedule!.frequency === '15_DAYS') && current.length >= 1) {
                                                            newDays = [day];
                                                        } else if (settings.pcdMainSchedule!.frequency === '2_WEEK' && current.length >= 2) {
                                                            newDays = [current[1], day];
                                                        } else if (settings.pcdMainSchedule!.frequency === '3_WEEK' && current.length >= 3) {
                                                            newDays = [current[1], current[2], day];
                                                        } else {
                                                            newDays = [...current, day];
                                                        }
                                                    }
                                                    setSettings({
                                                        ...settings,
                                                        pcdMainSchedule: { ...settings.pcdMainSchedule!, days: newDays }
                                                    });
                                                }}
                                                className={`px-3 py-1 rounded text-xs font-bold border ${
                                                    settings.pcdMainSchedule!.days?.includes(day) 
                                                        ? 'bg-blue-600 text-white border-blue-600' 
                                                        : 'bg-white text-gray-600 border-gray-300'
                                                }`}
                                            >
                                                {day}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="block text-sm font-medium text-gray-700">Horários e Examinadores</label>
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                const schedule = settings.pcdMainSchedule!;
                                                if (schedule.frequency === '2_DAY' && schedule.slots.length >= 2) {
                                                    alert('Frequência "2 vezes no dia" permite apenas 2 horários.');
                                                    return;
                                                }
                                                if (schedule.frequency === '2_WEEK' && schedule.slots.length >= 2) {
                                                    alert('Frequência "2 vezes na semana" permite apenas 2 horários.');
                                                    return;
                                                }
                                                if ((schedule.frequency === '1_WEEK' || schedule.frequency === '15_DAYS') && schedule.slots.length >= 1) {
                                                    alert('Esta frequência permite apenas 1 horário.');
                                                    return;
                                                }
                                                setSettings({
                                                    ...settings,
                                                    pcdMainSchedule: { ...schedule, slots: [...schedule.slots, { time: '', examiner: '', day: '' }] }
                                                });
                                            }}
                                            className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-200 hover:bg-blue-100"
                                        >
                                            + Adicionar Horário
                                        </button>
                                    </div>
                                    {settings.pcdMainSchedule.slots.map((slot, idx) => (
                                        <div key={idx} className="flex gap-2 items-center bg-gray-50 p-2 rounded border border-gray-200">
                                            {(settings.pcdMainSchedule!.frequency === '2_WEEK' || settings.pcdMainSchedule!.frequency === '3_WEEK') && (
                                                <select
                                                    className="border rounded p-1 text-sm bg-white text-gray-900"
                                                    value={slot.day || ''}
                                                    onChange={e => {
                                                        const newSlots = [...settings.pcdMainSchedule!.slots];
                                                        newSlots[idx] = { ...newSlots[idx], day: e.target.value };
                                                        setSettings({ ...settings, pcdMainSchedule: { ...settings.pcdMainSchedule!, slots: newSlots } });
                                                    }}
                                                >
                                                    <option value="">Dia</option>
                                                    {settings.pcdMainSchedule!.days.map(d => (
                                                        <option key={d} value={d}>{d}</option>
                                                    ))}
                                                </select>
                                            )}
                                            <input 
                                                type="time" 
                                                className="border rounded p-1 text-sm bg-white text-gray-900" 
                                                value={slot.time}
                                                onChange={e => {
                                                    const newSlots = [...settings.pcdMainSchedule!.slots];
                                                    newSlots[idx] = { ...newSlots[idx], time: e.target.value };
                                                    setSettings({ ...settings, pcdMainSchedule: { ...settings.pcdMainSchedule!, slots: newSlots } });
                                                }}
                                            />
                                            <select
                                                className="flex-1 border rounded p-1 text-sm bg-white text-gray-900"
                                                value={examiners.find(e => e.id === slot.examiner || e.name === slot.examiner)?.id || ''}
                                                onChange={e => {
                                                    const newSlots = [...settings.pcdMainSchedule!.slots];
                                                    newSlots[idx] = { ...newSlots[idx], examiner: e.target.value };
                                                    setSettings({ ...settings, pcdMainSchedule: { ...settings.pcdMainSchedule!, slots: newSlots } });
                                                }}
                                            >
                                                <option value="">Selecione o Examinador</option>
                                                {examiners.map(ex => (
                                                    <option key={ex.id} value={ex.id}>{ex.name}</option>
                                                ))}
                                            </select>
                                            <button 
                                                type="button" 
                                                onClick={() => {
                                                    const newSlots = settings.pcdMainSchedule!.slots.filter((_, i) => i !== idx);
                                                    setSettings({ ...settings, pcdMainSchedule: { ...settings.pcdMainSchedule!, slots: newSlots } });
                                                }}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                    {settings.pcdMainSchedule.slots.length === 0 && (
                                        <p className="text-xs text-gray-500 italic">Nenhum horário configurado.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSubTabCFC === 'ESCALA_PADRAO_CNH_BRASIL' && settings.cnhBrasilMainSchedule && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
                                <p className="text-sm text-blue-800">
                                    Configure aqui a escala padrão para os exames CNH DO BRASIL. Esta escala será usada como base para os agendamentos automáticos.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center bg-gray-50 p-3 rounded border border-gray-200">
                                    <div>
                                        <h4 className="font-bold text-sm">Status da Escala CNH DO BRASIL</h4>
                                        <p className="text-xs text-gray-500">{settings.cnhBrasilMainSchedule.active ? 'Esta escala está ATIVA' : 'Esta escala está DESATIVADA'}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSettings({
                                            ...settings,
                                            cnhBrasilMainSchedule: { ...settings.cnhBrasilMainSchedule!, active: !settings.cnhBrasilMainSchedule!.active }
                                        })}
                                        className={`px-4 py-2 rounded text-xs font-bold transition-colors ${
                                            settings.cnhBrasilMainSchedule.active 
                                                ? 'bg-red-100 text-red-600 border border-red-200 hover:bg-red-200' 
                                                : 'bg-green-100 text-green-600 border border-green-200 hover:bg-green-200'
                                        }`}
                                    >
                                        {settings.cnhBrasilMainSchedule.active ? 'DESATIVAR ESCALA' : 'ATIVAR ESCALA'}
                                    </button>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1 text-gray-700">Frequência</label>
                                    <select 
                                        className="w-full border rounded p-2 bg-white text-gray-900"
                                        value={settings.cnhBrasilMainSchedule.frequency}
                                        onChange={e => {
                                            const freq = e.target.value as any;
                                            let days = [...settings.cnhBrasilMainSchedule!.days];
                                            let slots = [...settings.cnhBrasilMainSchedule!.slots];
                                            
                                            if (freq === '1_WEEK' || freq === '2_DAY' || freq === '15_DAYS') {
                                                if (days.length > 1) days = days.length > 0 ? [days[0]] : [];
                                            } else if (freq === '2_WEEK') {
                                                if (days.length > 2) days = days.slice(0, 2);
                                            } else if (freq === '3_WEEK') {
                                                if (days.length > 3) days = days.slice(0, 3);
                                            }

                                            if (freq === '2_DAY' || freq === '2_WEEK') {
                                                if (slots.length > 2) slots = slots.slice(0, 2);
                                            } else if (freq === '3_WEEK') {
                                                if (slots.length > 3) slots = slots.slice(0, 3);
                                            } else if (freq === '1_WEEK' || freq === '15_DAYS') {
                                                if (slots.length > 1) slots = slots.slice(0, 1);
                                            }

                                            if (freq !== '2_WEEK' && freq !== '3_WEEK') {
                                                slots = slots.map(s => ({ ...s, day: '' }));
                                            }

                                            setSettings({
                                                ...settings,
                                                cnhBrasilMainSchedule: { ...settings.cnhBrasilMainSchedule!, frequency: freq, days, slots }
                                            });
                                        }}
                                    >
                                        <option value="1_WEEK">1 vez na semana</option>
                                        <option value="2_WEEK">2 vezes na semana</option>
                                        <option value="3_WEEK">3 vezes na semana</option>
                                        <option value="2_DAY">2 vezes no dia</option>
                                        <option value="15_DAYS">A cada 15 dias</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1 text-gray-700">Dias da Semana</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['SEG', 'TER', 'QUA', 'QUI', 'SEX'].map(day => (
                                            <button
                                                key={day}
                                                type="button"
                                                onClick={() => {
                                                    const current = settings.cnhBrasilMainSchedule!.days || [];
                                                    const isSelected = current.includes(day);
                                                    let newDays = [];
                                                    
                                                    if (isSelected) {
                                                        newDays = current.filter(d => d !== day);
                                                    } else {
                                                        if ((settings.cnhBrasilMainSchedule!.frequency === '1_WEEK' || settings.cnhBrasilMainSchedule!.frequency === '2_DAY' || settings.cnhBrasilMainSchedule!.frequency === '15_DAYS') && current.length >= 1) {
                                                            newDays = [day];
                                                        } else if (settings.cnhBrasilMainSchedule!.frequency === '2_WEEK' && current.length >= 2) {
                                                            newDays = [current[1], day];
                                                        } else if (settings.cnhBrasilMainSchedule!.frequency === '3_WEEK' && current.length >= 3) {
                                                            newDays = [current[1], current[2], day];
                                                        } else {
                                                            newDays = [...current, day];
                                                        }
                                                    }
                                                    setSettings({
                                                        ...settings,
                                                        cnhBrasilMainSchedule: { ...settings.cnhBrasilMainSchedule!, days: newDays }
                                                    });
                                                }}
                                                className={`px-3 py-1 rounded text-xs font-bold border ${
                                                    settings.cnhBrasilMainSchedule!.days?.includes(day) 
                                                        ? 'bg-blue-600 text-white border-blue-600' 
                                                        : 'bg-white text-gray-600 border-gray-300'
                                                }`}
                                            >
                                                {day}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="block text-sm font-medium text-gray-700">Horários e Examinadores</label>
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                const schedule = settings.cnhBrasilMainSchedule!;
                                                if (schedule.frequency === '2_DAY' && schedule.slots.length >= 2) {
                                                    alert('Frequência "2 vezes no dia" permite apenas 2 horários.');
                                                    return;
                                                }
                                                if (schedule.frequency === '2_WEEK' && schedule.slots.length >= 2) {
                                                    alert('Frequência "2 vezes na semana" permite apenas 2 horários.');
                                                    return;
                                                }
                                                if ((schedule.frequency === '1_WEEK' || schedule.frequency === '15_DAYS') && schedule.slots.length >= 1) {
                                                    alert('Esta frequência permite apenas 1 horário.');
                                                    return;
                                                }
                                                setSettings({
                                                    ...settings,
                                                    cnhBrasilMainSchedule: { ...schedule, slots: [...schedule.slots, { time: '', examiner: '', day: '' }] }
                                                });
                                            }}
                                            className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-200 hover:bg-blue-100"
                                        >
                                            + Adicionar Horário
                                        </button>
                                    </div>
                                    {settings.cnhBrasilMainSchedule.slots.map((slot, idx) => (
                                        <div key={idx} className="flex gap-2 items-center bg-gray-50 p-2 rounded border border-gray-200">
                                            {(settings.cnhBrasilMainSchedule!.frequency === '2_WEEK' || settings.cnhBrasilMainSchedule!.frequency === '3_WEEK') && (
                                                <select
                                                    className="border rounded p-1 text-sm bg-white text-gray-900"
                                                    value={slot.day || ''}
                                                    onChange={e => {
                                                        const newSlots = [...settings.cnhBrasilMainSchedule!.slots];
                                                        newSlots[idx] = { ...newSlots[idx], day: e.target.value };
                                                        setSettings({ ...settings, cnhBrasilMainSchedule: { ...settings.cnhBrasilMainSchedule!, slots: newSlots } });
                                                    }}
                                                >
                                                    <option value="">Dia</option>
                                                    {settings.cnhBrasilMainSchedule!.days.map(d => (
                                                        <option key={d} value={d}>{d}</option>
                                                    ))}
                                                </select>
                                            )}
                                            <input 
                                                type="time" 
                                                className="border rounded p-1 text-sm bg-white text-gray-900" 
                                                value={slot.time}
                                                onChange={e => {
                                                    const newSlots = [...settings.cnhBrasilMainSchedule!.slots];
                                                    newSlots[idx] = { ...newSlots[idx], time: e.target.value };
                                                    setSettings({ ...settings, cnhBrasilMainSchedule: { ...settings.cnhBrasilMainSchedule!, slots: newSlots } });
                                                }}
                                            />
                                            <select
                                                className="flex-1 border rounded p-1 text-sm bg-white text-gray-900"
                                                value={examiners.find(e => e.id === slot.examiner || e.name === slot.examiner)?.id || ''}
                                                onChange={e => {
                                                    const newSlots = [...settings.cnhBrasilMainSchedule!.slots];
                                                    newSlots[idx] = { ...newSlots[idx], examiner: e.target.value };
                                                    setSettings({ ...settings, cnhBrasilMainSchedule: { ...settings.cnhBrasilMainSchedule!, slots: newSlots } });
                                                }}
                                            >
                                                <option value="">Selecione o Examinador</option>
                                                {examiners.map(ex => (
                                                    <option key={ex.id} value={ex.id}>{ex.name}</option>
                                                ))}
                                            </select>
                                            <button 
                                                type="button" 
                                                onClick={() => {
                                                    const newSlots = settings.cnhBrasilMainSchedule!.slots.filter((_, i) => i !== idx);
                                                    setSettings({ ...settings, cnhBrasilMainSchedule: { ...settings.cnhBrasilMainSchedule!, slots: newSlots } });
                                                }}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                    {settings.cnhBrasilMainSchedule.slots.length === 0 && (
                                        <p className="text-xs text-gray-500 italic">Nenhum horário configurado.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'BACKUPS' && isAdmin && (
                <div className="space-y-6 animate-fadeIn">
                    <div className="bg-white border border-gray-200 p-6 rounded-xl space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">Backups do Sistema</h3>
                                <p className="text-sm text-gray-500">
                                    Um backup é feito automaticamente uma vez por dia quando um administrador entra no sistema.
                                    Os 15 backups mais recentes são mantidos. Senhas e registros de auditoria não são incluídos.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleCreateBackup}
                                disabled={creatingBackup}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                            >
                                <Plus className="h-4 w-4" /> {creatingBackup ? 'Criando...' : 'Criar backup agora'}
                            </button>
                        </div>

                        {backupsLoading ? (
                            <p className="text-sm text-gray-500 italic">Carregando backups...</p>
                        ) : backups.length === 0 ? (
                            <p className="text-sm text-gray-500 italic">Nenhum backup ainda. Um backup será criado automaticamente no próximo acesso do administrador, ou clique em "Criar backup agora".</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-gray-500 border-b">
                                            <th className="py-2 pr-4 font-semibold">Data e hora</th>
                                            <th className="py-2 pr-4 font-semibold">Tipo</th>
                                            <th className="py-2 pr-4 font-semibold">Tamanho</th>
                                            <th className="py-2 font-semibold text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {backups.map((b) => (
                                            <tr key={b.id} className="border-b last:border-b-0 hover:bg-gray-50">
                                                <td className="py-2 pr-4 text-gray-800">
                                                    {new Date(b.created_at || b.createdAt).toLocaleString('pt-BR')}
                                                </td>
                                                <td className="py-2 pr-4">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${(b.trigger_type || b.triggerType) === 'auto' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {(b.trigger_type || b.triggerType) === 'auto' ? 'Automático' : 'Manual'}
                                                    </span>
                                                </td>
                                                <td className="py-2 pr-4 text-gray-600">{formatBytes(b.size_bytes ?? b.sizeBytes ?? 0)}</td>
                                                <td className="py-2 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDownloadBackup(b)}
                                                        disabled={downloadingBackupId === b.id}
                                                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 disabled:opacity-50 font-semibold"
                                                    >
                                                        <Upload className="h-4 w-4 rotate-180" /> {downloadingBackupId === b.id ? 'Baixando...' : 'Baixar'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'RISK_AREA' && (
                <div className="space-y-6 animate-fadeIn">

                    {/* Zona de perigo */}
                    <div className="bg-red-50 border border-red-200 p-6 rounded-xl space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                                <AlertOctagon className="h-6 w-6 text-red-600" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-lg font-bold text-red-800">Zona de Perigo: Reset de Dados</h3>
                                <p className="text-sm text-red-700 leading-relaxed">
                                    Esta ação irá <strong>apagar permanentemente</strong> todos os dados operacionais do sistema, incluindo:
                                </p>
                                <ul className="list-disc list-inside text-sm text-red-700 space-y-1 ml-2">
                                    <li>Todos os Agendamentos (Solicitações)</li>
                                    <li>Todas as Escalas de Provas (Bancas)</li>
                                    <li>Todos os Resultados de Provas</li>
                                </ul>
                                <p className="text-sm text-red-700 pt-2">
                                    <strong>O que NÃO será apagado:</strong> Cadastros de Autoescolas, Examinadores, Instrutores, Veículos, Usuários, Cidades e Configurações do Sistema.
                                </p>
                            </div>
                        </div>

                        {/* Gate de verificação da chave */}
                        {settings.riskAreaKey && !riskKeyVerified && (
                            <div className="border-t border-red-200 pt-4 space-y-2">
                                <p className="text-sm font-semibold text-red-800 flex items-center gap-2">
                                    <ShieldAlert className="h-4 w-4" /> Digite a chave de segurança para liberar:
                                </p>
                                <div className="flex gap-2">
                                    <input
                                        type="password"
                                        placeholder="Chave secreta"
                                        className="flex-1 border border-red-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
                                        value={riskKeyInput}
                                        onChange={e => setRiskKeyInput(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                if (riskKeyInput === settings.riskAreaKey) setRiskKeyVerified(true);
                                                else setAlertConfig({ isOpen: true, title: 'Chave inválida', message: 'A chave de segurança digitada está incorreta.', type: 'error' });
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (riskKeyInput === settings.riskAreaKey) setRiskKeyVerified(true);
                                            else setAlertConfig({ isOpen: true, title: 'Chave inválida', message: 'A chave de segurança digitada está incorreta.', type: 'error' });
                                        }}
                                        className="px-4 py-2 bg-red-700 text-white text-sm font-bold rounded-lg hover:bg-red-800 whitespace-nowrap"
                                    >
                                        Verificar
                                    </button>
                                </div>
                            </div>
                        )}

                        {riskKeyVerified && (
                            <p className="text-xs text-green-700 font-semibold flex items-center gap-1.5 border-t border-red-200 pt-3">
                                <CheckCircle className="h-3.5 w-3.5" /> Chave verificada — operações liberadas
                            </p>
                        )}

                        {(!settings.riskAreaKey || riskKeyVerified) && !isConsultant && (
                            <div className="pt-2 flex justify-center">
                                <button
                                    type="button"
                                    onClick={handleResetData}
                                    disabled={saving}
                                    className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-xl font-black text-lg shadow-lg shadow-red-200 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Trash2 className="h-6 w-6" />
                                    ZERAR E RESETAR SISTEMA
                                </button>
                            </div>
                        )}
                    </div>

                </div>
            )}
        </div>

        <div className="bg-gray-50 p-6 border-t flex justify-end">
          {!isConsultant && (
              <button type="submit" disabled={saving} className="flex items-center px-8 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-bold disabled:opacity-50 shadow-md transition-all">
                {saving ? 'Salvando...' : 'Salvar Configurações'} <Save className="w-4 h-4 ml-2" />
              </button>
          )}
        </div>
      </form>

      <AlertModal 
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
      />

      {/* Reset Step 1 */}
      <ConfirmModal
        isOpen={resetConfirmStep1}
        onClose={() => setResetConfirmStep1(false)}
        onConfirm={() => { setResetConfirmStep1(false); setResetConfirmStep2(true); }}
        title="⚠️ Atenção: Zona de Perigo"
        message="Esta ação irá apagar TODOS os agendamentos, escalas e resultados do sistema. Os cadastros (Escolas, Examinadores, Instrutores, Usuários) e as configurações serão mantidos. Deseja continuar?"
        confirmText="Sim, continuar"
        cancelText="Cancelar"
        isDestructive={true}
      />

      {/* Reset Step 2 */}
      <ConfirmModal
        isOpen={resetConfirmStep2}
        onClose={() => setResetConfirmStep2(false)}
        onConfirm={executeResetData}
        title="🔴 Confirmação Final"
        message="Você tem certeza absoluta? Esta ação NÃO pode ser desfeita. Todos os dados operacionais serão permanentemente apagados."
        confirmText="SIM, ZERAR AGORA"
        cancelText="Cancelar"
        isDestructive={true}
      />
    </div>
  );
};

export default Settings;
