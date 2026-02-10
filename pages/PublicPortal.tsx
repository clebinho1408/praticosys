import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ExamType, RequestSource, ExamRequest, ExamStatus } from '../types';
import { api } from '../services/mockData';
import { ArrowRight, CheckCircle, AlertCircle, User, FileCheck, Send, ChevronRight, ChevronLeft } from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight lg:text-6xl">
          Agende sua Prova Prática
        </h1>
        <p className="mt-5 max-w-xl mx-auto text-xl text-gray-500">
          Selecione abaixo a modalidade desejada para iniciar sua solicitação de agendamento.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:gap-16 max-w-4xl mx-auto">
        {/* Card Comum */}
        <div className="bg-white overflow-hidden shadow-lg rounded-2xl hover:shadow-xl transition-shadow border border-gray-100">
          <div className="p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Prova Prática (1ª Habilitação)</h3>
            <p className="text-gray-600 mb-8">
              Destinado a candidatos das categorias A e B sem autoescola.
            </p>
            <ul className="space-y-3 mb-8 text-gray-500">
              <li className="flex items-center"><CheckCircle className="h-5 w-5 text-green-500 mr-2"/> Categoria A (Moto)</li>
              <li className="flex items-center"><CheckCircle className="h-5 w-5 text-green-500 mr-2"/> Categoria B (Carro)</li>
            </ul>
            <Link to="/request/common" className="w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 md:text-lg transition-colors">
              Solicitar Agendamento
            </Link>
          </div>
        </div>

        {/* Card PCD */}
        <div className="bg-white overflow-hidden shadow-lg rounded-2xl hover:shadow-xl transition-shadow border border-gray-100 relative">
          <div className="p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Prova de Direção (PCD)</h3>
            <p className="text-gray-600 mb-8">
              Área exclusiva para condutores já Habilitados e que receberam uma Restrição do Médico na sua Habilitação.
            </p>
            <ul className="space-y-3 mb-8 text-gray-500">
              <li className="flex items-center"><CheckCircle className="h-5 w-5 text-green-500 mr-2"/> Veículos Adaptados</li>
              <li className="flex items-center"><CheckCircle className="h-5 w-5 text-green-500 mr-2"/> Banca Especial</li>
              <li className="flex items-center"><CheckCircle className="h-5 w-5 text-green-500 mr-2"/> Acessibilidade</li>
            </ul>
            <Link to="/request/pcd" className="w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 md:text-lg transition-colors">
              Acesso Portal PCD
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export const CommonRequestForm: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    cpf: '',
    studentName: '',
    phone: '',
    email: '',
    address: '',
    paidFee: 'false',
    completedPracticalCourse: 'false',
    practicalHours: '',
    hasVehicle: 'false',
    observation: '',
    desiredDate: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => {
        const updates = { ...prev, [name]: value };
        
        // Auto-set default hours to 2 when course is marked as completed
        if (name === 'completedPracticalCourse' && value === 'true') {
            updates.practicalHours = '2';
        }
        
        return updates;
    });
  };

  const validateStep = (step: number): boolean => {
    if (step === 1) {
      if (!formData.cpf || !formData.studentName || !formData.phone || !formData.email || !formData.address) {
        alert('Por favor, preencha todos os campos obrigatórios desta etapa.');
        return false;
      }
    }
    if (step === 2) {
      if (formData.completedPracticalCourse === 'true') {
        if (!formData.practicalHours || parseInt(formData.practicalHours) < 2) {
            alert('A quantidade mínima de horas é 2.');
            return false;
        }
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(curr => Math.min(curr + 1, 3));
    }
  };

  const prevStep = () => {
    setCurrentStep(curr => Math.max(curr - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(currentStep)) return;
    
    setLoading(true);
    
    try {
      await api.createRequest({
        studentName: formData.studentName,
        cpf: formData.cpf,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        examType: ExamType.COMMON,
        source: RequestSource.STUDENT_DIRECT,
        desiredDate: new Date().toISOString().split('T')[0],
        paidFee: formData.paidFee === 'true',
        completedPracticalCourse: formData.completedPracticalCourse === 'true',
        practicalHours: formData.practicalHours ? parseInt(formData.practicalHours) : 0,
        hasVehicle: formData.hasVehicle === 'true',
        observation: formData.observation,
        status: ExamStatus.WAITING_SCHEDULING
      });
      navigate('/success');
    } catch (error) {
      console.error(error);
      alert('Erro ao enviar solicitação.');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { id: 1, name: 'Dados Pessoais', icon: User },
    { id: 2, name: 'Requisitos', icon: FileCheck },
    { id: 3, name: 'Finalizar', icon: Send },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="bg-white shadow-lg rounded-xl overflow-hidden">
        
        {/* Header / Stepper */}
        <div className="bg-gray-50 border-b border-gray-200">
           <div className="flex justify-between items-center px-4 py-4">
              {steps.map((step) => {
                const Icon = step.icon;
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;
                
                return (
                  <div key={step.id} className={`flex flex-col items-center flex-1 ${isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 transition-colors ${isActive ? 'bg-blue-100' : isCompleted ? 'bg-green-100' : 'bg-gray-200'}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-medium text-center">{step.name}</span>
                  </div>
                );
              })}
           </div>
           {/* Progress Bar */}
           <div className="h-1 w-full bg-gray-200">
              <div 
                className="h-full bg-blue-600 transition-all duration-300 ease-in-out" 
                style={{ width: `${(currentStep / 3) * 100}%` }}
              />
           </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 md:p-8">
          <div className="min-h-[400px]">
            {/* Step 1: Personal Data */}
            {currentStep === 1 && (
              <div className="space-y-6 animate-fadeIn">
                <h3 className="text-lg font-bold text-gray-900 border-b pb-2">1. Informações do Candidato</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700">CPF <span className="text-red-500">*</span></label>
                  <input required name="cpf" value={formData.cpf} type="text" placeholder="000.000.000-00" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-3 bg-white text-gray-900" onChange={handleChange} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Nome Completo <span className="text-red-500">*</span></label>
                  <input required name="studentName" value={formData.studentName} type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-3 bg-white text-gray-900" onChange={handleChange} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Telefone <span className="text-red-500">*</span></label>
                  <input required name="phone" value={formData.phone} type="tel" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-3 bg-white text-gray-900" onChange={handleChange} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">E-mail <span className="text-red-500">*</span></label>
                  <input required name="email" value={formData.email} type="email" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-3 bg-white text-gray-900" onChange={handleChange} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Endereço <span className="text-red-500">*</span></label>
                  <input required name="address" value={formData.address} type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-3 bg-white text-gray-900" onChange={handleChange} />
                </div>
              </div>
            )}

            {/* Step 2: Requirements */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-fadeIn">
                 <h3 className="text-lg font-bold text-gray-900 border-b pb-2">2. Requisitos e Taxas</h3>
                
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">Já pagou a Taxa de R$72,24?</label>
                   <div className="flex gap-4">
                     <label className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50 flex-1">
                       <input type="radio" name="paidFee" value="true" checked={formData.paidFee === 'true'} onChange={handleChange} className="text-blue-600 focus:ring-blue-500 h-4 w-4" />
                       <span className="ml-2 text-sm text-gray-700">Sim</span>
                     </label>
                     <label className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50 flex-1">
                       <input type="radio" name="paidFee" value="false" checked={formData.paidFee === 'false'} onChange={handleChange} className="text-blue-600 focus:ring-blue-500 h-4 w-4" />
                       <span className="ml-2 text-sm text-gray-700">Não</span>
                     </label>
                   </div>
                   {formData.paidFee === 'false' && (
                      <div className="mt-3 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-md flex items-start">
                        <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                        <p className="text-sm text-red-700 font-bold">
                          Atenção: o agendamento da Prova Prática somente será efetivado após a quitação da respectiva taxa.
                        </p>
                      </div>
                   )}
                </div>

                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">Já concluiu o Curso Prático?</label>
                   <div className="flex gap-4">
                     <label className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50 flex-1">
                       <input type="radio" name="completedPracticalCourse" value="true" checked={formData.completedPracticalCourse === 'true'} onChange={handleChange} className="text-blue-600 focus:ring-blue-500 h-4 w-4" />
                       <span className="ml-2 text-sm text-gray-700">Sim</span>
                     </label>
                     <label className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50 flex-1">
                       <input type="radio" name="completedPracticalCourse" value="false" checked={formData.completedPracticalCourse === 'false'} onChange={handleChange} className="text-blue-600 focus:ring-blue-500 h-4 w-4" />
                       <span className="ml-2 text-sm text-gray-700">Não</span>
                     </label>
                   </div>
                </div>

                {formData.completedPracticalCourse === 'true' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Quantas horas de Curso realizou?</label>
                    <input 
                        required 
                        name="practicalHours" 
                        type="number" 
                        min="2"
                        value={formData.practicalHours}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-3 bg-white text-gray-900" 
                        onChange={handleChange} 
                    />
                    <p className="text-xs text-gray-500 mt-1">Mínimo obrigatório: 2 horas.</p>
                  </div>
                )}

                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">Possui Carro/Moto para o dia da Prova?</label>
                   <select name="hasVehicle" value={formData.hasVehicle} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-3 bg-white text-gray-900" onChange={handleChange}>
                     <option value="false">Não</option>
                     <option value="true">Sim</option>
                   </select>
                </div>
              </div>
            )}

            {/* Step 3: Finalize */}
            {currentStep === 3 && (
              <div className="space-y-6 animate-fadeIn">
                <h3 className="text-lg font-bold text-gray-900 border-b pb-2">3. Confirmação e Observações</h3>
                
                <div className="bg-blue-50 p-4 rounded-md text-sm text-blue-900">
                   <p className="font-semibold mb-2">Resumo da Solicitação:</p>
                   <ul className="list-disc pl-5 space-y-1">
                     <li>Candidato: {formData.studentName}</li>
                     <li>CPF: {formData.cpf}</li>
                     <li>Taxa Paga: {formData.paidFee === 'true' ? 'Sim' : 'Não'}</li>
                     <li>Curso Prático: {formData.completedPracticalCourse === 'true' ? 'Sim' : 'Não'}</li>
                   </ul>
                </div>

                <div>
                   <label className="block text-sm font-medium text-gray-700">Observações Adicionais</label>
                   <textarea 
                     name="observation" 
                     value={formData.observation}
                     rows={4} 
                     className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-3 bg-white text-gray-900" 
                     onChange={handleChange}
                     placeholder="Caso tenha alguma dúvida ou informação extra, digite aqui."
                   ></textarea>
                </div>
              </div>
            )}
          </div>

          <div className="pt-6 mt-6 border-t border-gray-100 flex justify-between">
            {currentStep > 1 ? (
              <button 
                type="button" 
                onClick={prevStep}
                className="flex items-center px-6 py-3 border border-gray-300 rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 font-medium transition-colors"
              >
                <ChevronLeft className="w-4 h-4 mr-2" /> Voltar
              </button>
            ) : (
              <div></div> // Spacer
            )}

            {currentStep < 3 ? (
              <button 
                type="button" 
                onClick={nextStep}
                className="flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 font-medium transition-colors"
              >
                Próximo <ChevronRight className="w-4 h-4 ml-2" />
              </button>
            ) : (
              <button 
                type="submit" 
                disabled={loading} 
                className="flex items-center px-8 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium shadow-sm disabled:opacity-50"
              >
                {loading ? 'Enviando...' : 'Enviar Solicitação'} <CheckCircle className="w-4 h-4 ml-2" />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export const PCDRequestForm: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    studentName: '',
    cpf: '',
    phone: '',
    email: '',
    desiredDate: '',
    disabilityType: '',
    specialNeeds: '',
    observations: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await api.createRequest({
        studentName: formData.studentName,
        cpf: formData.cpf,
        phone: formData.phone,
        email: formData.email,
        examType: ExamType.PCD,
        source: RequestSource.STUDENT_DIRECT,
        desiredDate: formData.desiredDate,
        disabilityType: formData.disabilityType,
        specialNeeds: formData.specialNeeds,
        observation: formData.observations,
        status: ExamStatus.WAITING_SCHEDULING
      });
      navigate('/success');
    } catch (error) {
      console.error(error);
      alert('Erro ao enviar solicitação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white shadow-lg rounded-xl overflow-hidden">
        <div className="p-6 bg-blue-50 border-b border-blue-100">
          <h2 className="text-xl font-bold text-gray-800">
            Solicitação de Prova de Direção (PCD)
          </h2>
          <p className="text-sm text-gray-500 mt-1">Preencha os dados abaixo para iniciar o processo.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">Nome Completo</label>
              <input required name="studentName" type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 bg-white text-gray-900" onChange={handleChange} />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">CPF</label>
              <input required name="cpf" type="text" placeholder="000.000.000-00" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 bg-white text-gray-900" onChange={handleChange} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Telefone</label>
              <input required name="phone" type="tel" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 bg-white text-gray-900" onChange={handleChange} />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">E-mail</label>
              <input required name="email" type="email" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 bg-white text-gray-900" onChange={handleChange} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Data Desejada</label>
              <input required name="desiredDate" type="date" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 bg-white text-gray-900" onChange={handleChange} />
            </div>
          </div>

          <div className="space-y-6 pt-6 border-t border-gray-100">
              <h3 className="font-medium text-blue-900">Informações da Deficiência</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700">Tipo de Deficiência</label>
                <select required name="disabilityType" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 bg-white text-gray-900" onChange={handleChange}>
                  <option value="">Selecione...</option>
                  <option value="Física">Física</option>
                  <option value="Auditiva">Auditiva</option>
                  <option value="Visual">Visual</option>
                  <option value="Intelectual">Intelectual</option>
                  <option value="Outra">Outra</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Necessidades Especiais / Adaptações</label>
                <textarea name="specialNeeds" rows={3} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 bg-white text-gray-900" placeholder="Ex: Carro com acelerador manual à esquerda..." onChange={handleChange}></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Observações Adicionais</label>
                <textarea name="observations" rows={2} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 bg-white text-gray-900" onChange={handleChange}></textarea>
              </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button type="submit" disabled={loading} className="bg-blue-600 text-white px-8 py-3 rounded-md hover:bg-blue-700 transition-colors font-medium shadow-sm disabled:opacity-50">
              {loading ? 'Enviando...' : 'Enviar Solicitação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const StatusCheck: React.FC = () => {
  const [cpf, setCpf] = useState('');
  const [results, setResults] = useState<ExamRequest[] | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSearched(true);
    const data = await api.getRequestByCpf(cpf);
    setResults(data);
    setLoading(false);
  };

  const getStatusColor = (status: ExamStatus) => {
    switch(status) {
      case ExamStatus.WAITING_SCHEDULING: return 'bg-gray-100 text-gray-800';
      case ExamStatus.SCHEDULED: return 'bg-yellow-100 text-yellow-800';
      case ExamStatus.WAITING_RESULT: return 'bg-purple-100 text-purple-800';
      case ExamStatus.DONE: return 'bg-green-100 text-green-800';
      case ExamStatus.RETEST: return 'bg-orange-100 text-orange-800';
      case ExamStatus.CANCELLED: return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const translateStatus = (status: string) => {
    const map: Record<string, string> = {
      WAITING_SCHEDULING: 'Aguardando Agendamento',
      SCHEDULED: 'Agendado',
      WAITING_RESULT: 'Aguardando Resultado',
      DONE: 'Realizado',
      RETEST: 'Reteste',
      CANCELLED: 'Cancelado'
    };
    return map[status] || status;
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="bg-white shadow-md rounded-lg p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">Consultar Status</h2>
        <form onSubmit={handleSearch} className="flex gap-4">
          <input
            type="text"
            placeholder="Digite seu CPF (apenas números ou com pontuação)"
            className="flex-1 rounded-md border border-gray-300 p-3 bg-white text-gray-900"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            required
          />
          <button type="submit" disabled={loading} className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors">
            {loading ? 'Consultando...' : 'Consultar'}
          </button>
        </form>
      </div>

      {searched && !loading && (
        <div className="space-y-4">
          {results && results.length > 0 ? (
            results.map((req) => (
              <div key={req.id} className="bg-white border-l-4 border-blue-500 shadow-sm rounded-r-lg p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{req.studentName}</h3>
                    <p className="text-sm text-gray-500">Prova: {req.examType === ExamType.COMMON ? '1ª Habilitação' : 'PCD'}</p>
                    <p className="text-sm text-gray-500">Data Desejada: {new Date(req.desiredDate).toLocaleDateString()}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(req.status)}`}>
                    {translateStatus(req.status)}
                  </span>
                </div>
                {req.status === ExamStatus.SCHEDULED && (
                   <div className="mt-4 bg-yellow-50 p-3 rounded-md text-yellow-900 text-sm">
                     <strong>Agendamento Confirmado:</strong> {new Date(req.scheduledDate!).toLocaleDateString()} às {req.scheduledTime}
                   </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg text-gray-500">
              <AlertCircle className="mx-auto h-12 w-12 text-gray-300 mb-2" />
              Nenhuma solicitação encontrada para este CPF.
            </div>
          )}
        </div>
      )}
    </div>
  );
};