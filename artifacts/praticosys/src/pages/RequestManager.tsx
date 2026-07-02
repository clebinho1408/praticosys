// Request Manager Page
import React, { useState, useEffect, useMemo } from "react";
import { api } from "../services/api";
import {
  ExamRequest,
  User,
  UserRole,
  ExamType,
  RequestSource,
  ExamStatus,
  ExamResult,
  Instructor,
  Examiner,
  ExamSchedule,
  City,
  SystemSettings,
} from "../types";
import { NotificationModal } from "../components/NotificationModal";
import {
  Plus,
  Search,
  Edit,
  X,
  Gavel,
  ChevronDown,
  ChevronUp,
  Clock,
  Calendar,
  CheckCircle,
  AlertOctagon,
  AlertTriangle,
  Filter,
  Trash2,
  Check,
  Ban,
  ClipboardList,
  UserCheck,
  FileSearch,
} from "lucide-react";

const validateCPF = (cpf: string) => {
  cpf = cpf.replace(/[^\d]+/g, "");
  if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
  let soma = 0;
  let resto;
  for (let i = 1; i <= 9; i++)
    soma = soma + parseInt(cpf.substring(i - 1, i)) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(9, 10))) return false;
  soma = 0;
  for (let i = 1; i <= 10; i++)
    soma = soma + parseInt(cpf.substring(i - 1, i)) * (12 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(10, 11))) return false;
  return true;
};

const maskCpf = (cpf: string) => {
  if (!cpf) return "";
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return cpf;
  return `***.${cleaned.substring(3, 6)}.${cleaned.substring(6, 9)}-**`;
};

const ResultBadge: React.FC<{ result?: ExamResult; status: ExamStatus }> = ({
  result,
  status,
}) => {
  if (status === ExamStatus.WAITING_RESULT)
    return (
      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
        Aguardando
      </span>
    );
  if (!result) return null;

  const colors: Record<string, string> = {
    APTO: "bg-green-100 text-green-800",
    INAPTO: "bg-red-100 text-red-800",
    FALTOU: "bg-orange-100 text-orange-800",
    CANCELADO: "bg-gray-100 text-gray-800",
  };

  return (
    <span
      className={`text-xs px-2 py-1 rounded font-bold ${colors[result] || "bg-gray-100"}`}
    >
      {result}
    </span>
  );
};

const CountdownTimer: React.FC<{ targetDate: Date; onExpire?: () => void }> = ({ targetDate, onExpire }) => {
  const [timeLeft, setTimeLeft] = useState<number>(targetDate.getTime() - new Date().getTime());

  useEffect(() => {
    const interval = setInterval(() => {
      const newTime = targetDate.getTime() - new Date().getTime();
      setTimeLeft(newTime);
      if (newTime <= 0) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate, onExpire]);

  if (timeLeft <= 0) return null;

  const hours = Math.floor(timeLeft / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

  return (
    <div className="flex items-center gap-1 text-orange-600 font-mono text-sm">
      <Clock className="h-3 w-3" />
      <span>{hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}</span>
    </div>
  );
};

interface RequestManagerProps {
  user: User;
  typeFilter?: ExamType;
  sourceFilter?: RequestSource;
  excludeRegularSchools?: boolean;
}

const RequestManager: React.FC<RequestManagerProps> = ({
  user,
  typeFilter,
  sourceFilter,
  excludeRegularSchools,
}) => {
  const [requests, setRequests] = useState<ExamRequest[]>([]);
  const [allGlobalRequests, setAllGlobalRequests] = useState<ExamRequest[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [examiners, setExaminers] = useState<Examiner[]>([]);
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const isAdminOpSup = user.role === UserRole.ADMIN || user.role === UserRole.OPERATOR || user.role === UserRole.SUPERVISOR;
  const isConsultant = user.role === UserRole.CONSULTANT;

  // Estado para controlar quais grupos estão expandidos
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {
      [ExamStatus.IN_ANALYSIS]: false,
      [ExamStatus.WAITING_SCHEDULING]: false,
      [ExamStatus.SCHEDULED]: false,
      [ExamStatus.WAITING_RESULT]: false,
      [ExamStatus.DONE]: false,
      [ExamStatus.CANCELLED]: false,
    },
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [isResultConfirmOpen, setIsResultConfirmOpen] = useState(false);
  const [isChangeResultModalOpen, setIsChangeResultModalOpen] = useState(false);
  const [changeResultData, setChangeResultData] = useState<{
    requestId: string;
    historyId: string;
    currentResult: string;
  } | null>(null);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [errorField, setErrorField] = useState<string | null>(null);
  const [isABConfirmationOpen, setIsABConfirmationOpen] = useState(false);
  const [checkedRequests, setCheckedRequests] = useState<Set<string>>(new Set());
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
  const [rejectionData, setRejectionData] = useState<{ requestId: string; reason: string }>({ requestId: '', reason: '' });
  const [editingRequest, setEditingRequest] = useState<ExamRequest | null>(
    null,
  );
  // isViewOnly: true when opening modal in read-only mode
  // - Admin/Supervisor/Operator viewing a DONE record
  // - Operator opening ANY existing record (always view-only)
  const isViewOnly = (editingRequest?.status === ExamStatus.DONE && isAdminOpSup)
    || (!!editingRequest && user.role === UserRole.OPERATOR);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [notificationData, setNotificationData] = useState({ title: '', message: '', id: '' });
  const [notificationQueue, setNotificationQueue] = useState<{ title: string; message: string; id: string }[]>([]);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [approvalData, setApprovalData] = useState<ExamRequest | null>(null);
  const [expandedWeekdays, setExpandedWeekdays] = useState<Record<string, boolean>>({});
  const [confirmModalData, setConfirmModalData] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'confirm' | 'cancel';
    confirmLabel?: string; // Label personalizado para o botão de ação
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'confirm' });
  const [restrictionModalData, setRestrictionModalData] = useState<{ isOpen: boolean; restrictions: string }>({ isOpen: false, restrictions: "" });
  const [historyModalData, setHistoryModalData] = useState<{ isOpen: boolean; request: ExamRequest | null }>({ isOpen: false, request: null });

  // Form State
  const [formData, setFormData] = useState<Partial<ExamRequest>>({});
  const [resultData, setResultData] = useState<{
    result: ExamResult;
    observation: string;
  }>({ result: "APTO", observation: "" });
  const [activeTab, setActiveTab] = useState<"personal" | "exam" | "history">(
    "personal",
  );

  const fetchRequests = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [data, instructorsData, examinersData, schedulesData, citiesData, settingsData] =
        await Promise.all([
          api.getRequests(),
          api.getInstructorsAsync(),
          api.getExaminersAsync(),
          api.getSchedules(),
          api.getCities(),
          api.getSettings(),
        ]);
      setInstructors(instructorsData);
      setExaminers(examinersData);
      setSchedules(schedulesData);
      setCities(citiesData);
      setSettings(settingsData);
      setAllGlobalRequests(data);
      let filtered = data;

      // Role Filtering
      if (user.role === UserRole.SCHOOL) {
        filtered = filtered.filter((r) => r.schoolId === user.schoolId);
      } else if (user.role === UserRole.INSTRUCTOR && user.instructorId) {
        const myInstructor = instructorsData.find(
          (i) => i.id === user.instructorId,
        );
        if (myInstructor) {
          filtered = filtered.filter((r) =>
            r.instructor?.includes(myInstructor.name),
          );
        } else {
          filtered = []; // Se não encontrar o instrutor, não mostra nada
        }
      }

      // Prop Type Filtering
      if (typeFilter) {
        filtered = filtered.filter((r) => r.examType === typeFilter);
      }

      // Hide CFC items if we are in CNH module
      if (excludeRegularSchools) {
        filtered = filtered.filter(r => !r.schoolId || r.schoolId === 'CNH_BRASIL');
      }

      // Hide auto-generated slots that have no real candidate (empty studentName or placeholder CPF).
      // These are created by the auto-schedule generator and should never appear in the Candidates list.
      filtered = filtered.filter(r => {
        const name = r.studentName?.trim();
        const cpf = r.cpf?.replace(/\D/g, '');
        // Keep records that have a real student name (not empty, null, or 'Vaga Disponível')
        return name && name !== 'Vaga Disponível' && cpf && cpf !== '00000000000';
      });

      // Source Filtering
      if (sourceFilter) {
        filtered = filtered.filter((r) => r.source === sourceFilter);
      }

      // Sort by updatedAt ASC (oldest first, newest at the bottom)
      filtered.sort(
        (a, b) =>
          new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
      );

      setRequests(filtered);
    } catch (error) {
      console.error(error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    // Polling de 8s para Instrutores e Admin/Supervisor/Operador — atualizações em tempo real.
    // Instrutores: veem alterações de status feitas pelo admin (agendamentos, confirmações).
    // Admin/Sup/Op: veem novos Pedidos de Agendamento enviados por instrutores instantaneamente.
    if (user.role === UserRole.INSTRUCTOR || isAdminOpSup) {
      const interval = setInterval(() => fetchRequests(true), 60000);
      return () => clearInterval(interval);
    }
  }, [user, typeFilter]);

  // Process Notification Queue
  useEffect(() => {
    if (!isNotificationModalOpen && notificationQueue.length > 0) {
      const next = notificationQueue[0];
      setNotificationData(next);
      setIsNotificationModalOpen(true);
    }
  }, [isNotificationModalOpen, notificationQueue]);

  useEffect(() => {
    const eventSource = new EventSource('/api/events');

    eventSource.addEventListener('requests_updated', (event) => {
      const data = JSON.parse(event.data);
      if (user.role === UserRole.INSTRUCTOR) {
        const notifiedIds = JSON.parse(localStorage.getItem(`notified_requests_${user.id}`) || '[]');
        if (data.status === ExamStatus.SCHEDULED && !data.attendanceConfirmed && !notifiedIds.includes(data.id)) {
          const newNotif = { 
            title: 'Nova Notificação', 
            message: `O candidato ${data.socialName || data.studentName} está aguardando confirmação para a prova!`,
            id: data.id
          };
          setNotificationQueue(prev => {
            const exists = prev.some(n => n.id === newNotif.id);
            if (exists) return prev;
            return [...prev, newNotif];
          });
        } else if (data.status === ExamStatus.CANCELLED && !notifiedIds.includes(data.id)) {
          const newNotif = { 
            title: 'Agendamento Recusado', 
            message: `O agendamento do candidato ${data.socialName || data.studentName} foi recusado. Motivo: ${data.cancellationReason || 'Não informado'}`,
            id: data.id
          };
          setNotificationQueue(prev => {
            const exists = prev.some(n => n.id === newNotif.id);
            if (exists) return prev;
            return [...prev, newNotif];
          });
        }
      }
      fetchRequests(true);
    });

    eventSource.addEventListener('schedules_updated', () => {
      fetchRequests(true);
    });

    return () => {
      eventSource.close();
    };
  }, [user, typeFilter]);

  useEffect(() => {
    if (isModalOpen) {
      api.getInstructorsAsync().then(setInstructors);
    }
  }, [isModalOpen]);

  // Persistent notifications for Instructor (on login/refresh)
  useEffect(() => {
    if (user.role === UserRole.INSTRUCTOR && requests.length > 0) {
      const notifiedIds = JSON.parse(localStorage.getItem(`notified_requests_${user.id}`) || '[]');
      
      // Check for new rejections
      const newRejections = requests.filter(r => 
        r.status === ExamStatus.CANCELLED && !notifiedIds.includes(r.id)
      ).map(r => ({
        title: 'Agendamento Recusado', 
        message: `O agendamento do candidato ${r.socialName || r.studentName} foi recusado. Motivo: ${r.cancellationReason || 'Não informado'}`,
        id: r.id
      }));

      // Check for new waiting confirmations
      const newWaitingConfirmations = requests.filter(r => 
        r.status === ExamStatus.SCHEDULED && !r.attendanceConfirmed && !notifiedIds.includes(r.id)
      ).map(r => ({
        title: 'Nova Notificação', 
        message: `O candidato ${r.socialName || r.studentName} está aguardando confirmação para a prova!`,
        id: r.id
      }));

      const allNew = [...newRejections, ...newWaitingConfirmations];
      
      if (allNew.length > 0) {
        setNotificationQueue(prev => {
          const existingIds = prev.map(n => n.id);
          const trulyNew = allNew.filter(n => !notifiedIds.includes(n.id) && !existingIds.includes(n.id));
          if (trulyNew.length === 0) return prev;
          return [...prev, ...trulyNew];
        });
      }
    }
  }, [requests, user]);

  useEffect(() => {
    const checkScheduledExams = async () => {
      if (!isAdminOpSup || requests.length === 0) return;

      const now = new Date();
      let hasUpdates = false;

      for (const req of requests) {
        if (req.status === ExamStatus.SCHEDULED) {
          const schedule = schedules.find(s => s.id === req.scheduleId);
          const dateStr = schedule?.date || req.scheduledDate;
          const timeStr = schedule?.time || req.scheduledTime;

          if (dateStr && timeStr) {
            const examDateTime = new Date(`${dateStr}T${timeStr}`);
            if (!isNaN(examDateTime.getTime())) {
              const fourHoursInMs = 4 * 60 * 60 * 1000;
              if (now.getTime() >= examDateTime.getTime() + fourHoursInMs) {
                try {
                  await api.updateRequest(req.id, { status: ExamStatus.WAITING_RESULT });
                  hasUpdates = true;
                } catch (error) {
                  console.error("Failed to auto-update status:", error);
                }
              }
            }
          }
        }
      }

      if (hasUpdates) {
        fetchRequests(true);
      }
    };

    const intervalId = setInterval(checkScheduledExams, 60000);
    checkScheduledExams();

    return () => clearInterval(intervalId);
  }, [requests, schedules, isAdminOpSup]);

  // Handle Filter Change logic (Auto open accordion if specific status selected)
  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    if (status !== "ALL") {
      // Fecha todos e abre apenas o selecionado
      const newExpandedState = { ...expandedGroups };
      Object.keys(newExpandedState).forEach(
        (k) => (newExpandedState[k] = false),
      );
      newExpandedState[status] = true;
      setExpandedGroups(newExpandedState);
    } else {
      // Se selecionar "Todos", fecha tudo (ou mantém o estado anterior, optei por fechar p/ limpar a tela)
      const newExpandedState = { ...expandedGroups };
      Object.keys(newExpandedState).forEach(
        (k) => (newExpandedState[k] = false),
      );
      setExpandedGroups(newExpandedState);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validação de Campos Obrigatórios (base)
    const requiredFields = [
      { field: "cpf", label: "CPF" },
      { field: "studentName", label: "Nome Completo" },

      { field: "intendedCategory", label: "Categoria Pretendida" },
    ];

    // Cidade é obrigatória para Instrutores
    if (user.role === UserRole.INSTRUCTOR) {
      requiredFields.push({ field: "city", label: "Cidade" });
    }

    for (const req of requiredFields) {
      if (!formData[req.field as keyof ExamRequest]) {
        setErrorMessage(`O campo ${req.label} é obrigatório.`);
        setErrorField(req.field);
        setIsErrorModalOpen(true);
        return;
      }
    }

    if (!validateCPF(formData.cpf || "")) {
      setErrorMessage("CPF inválido! Por favor, verifique o número digitado.");
      setErrorField("cpf");
      setIsErrorModalOpen(true);
      return;
    }

    // Verificação de CPF duplicado (somente ao criar novo candidato)
    if (!editingRequest) {
      const cleanCpf = (formData.cpf || "").replace(/\D/g, "");
      const newCat = formData.intendedCategory || "";

      // Status considerados "em andamento" — bloqueiam novo cadastro na mesma categoria
      const activeStatuses: string[] = [
        ExamStatus.IN_ANALYSIS,
        ExamStatus.WAITING_SCHEDULING,
        ExamStatus.SCHEDULED,
        ExamStatus.WAITING_RESULT,
        ExamStatus.RETEST,
      ];

      const duplicate = allGlobalRequests.find((r) => {
        const rCpf = (r.cpf || "").replace(/\D/g, "");
        if (rCpf !== cleanCpf) return false;
        // Ignora registros encerrados (CANCELLED ou DONE) — pode recadastrar
        if (!activeStatuses.includes(r.status)) return false;
        // Determina a categoria existente
        const existingCat = r.intendedCategory || "";
        // Bloqueia apenas se as categorias se sobrepõem:
        // A == A, B == B, AB sobrepõe A e B
        const overlap = (a: string, b: string) => {
          if (a === b) return true;
          if (a === "AB" || b === "AB") return true;
          return false;
        };
        return overlap(existingCat, newCat);
      });

      if (duplicate) {
        const name = duplicate.socialName || duplicate.studentName || "este candidato";
        const statusLabels: Record<string, string> = {
          IN_ANALYSIS: "Candidatos Pendentes",
          WAITING_SCHEDULING: "Aguardando Agendamento",
          SCHEDULED: "Agendado",
          WAITING_RESULT: "Aguardando Resultado",
          RETEST: "Reteste",
        };
        const statusLabel = statusLabels[duplicate.status] || duplicate.status;
        setErrorMessage(
          `O candidato "${name}" já possui um processo ativo para a Categoria ${duplicate.intendedCategory || ''} (${statusLabel}). Não é possível abrir um novo cadastro para a mesma categoria enquanto houver um em andamento.`
        );
        setErrorField("cpf");
        setIsErrorModalOpen(true);
        return;
      }
    }

    // Validação específica por categoria
    if (
      formData.intendedCategory === "A" ||
      formData.intendedCategory === "AB"
    ) {
      const motoInstr =
        formData.intendedCategory === "AB"
          ? formData.instructor?.split(" / ")[0]?.replace(/^Moto:\s*/, "")
          : formData.instructor;
      const motoPlate =
        formData.intendedCategory === "AB"
          ? formData.vehiclePlate?.split(" / ")[0]?.replace(/^Moto:\s*/, "")
          : formData.vehiclePlate;

      if (!motoInstr || !motoPlate) {
        setErrorMessage(
          "Para Categoria A, Instrutor e Veículo (Moto) são obrigatórios.",
        );
        setErrorField("instructor_A"); // We will add this ID
        setIsErrorModalOpen(true);
        return;
      }
    }

    if (
      formData.intendedCategory === "B" ||
      formData.intendedCategory === "AB"
    ) {
      const carInstr =
        formData.intendedCategory === "AB"
          ? formData.instructor?.split(" / ")[1]?.replace(/^Carro:\s*/, "")
          : formData.instructor;
      const carPlate =
        formData.intendedCategory === "AB"
          ? formData.vehiclePlate?.split(" / ")[1]?.replace(/^Carro:\s*/, "")
          : formData.vehiclePlate;

      if (!carInstr || !carPlate) {
        setErrorMessage(
          "Para Categoria B, Instrutor e Veículo (Carro) são obrigatórios.",
        );
        setErrorField("instructor_B"); // We will add this ID
        setIsErrorModalOpen(true);
        return;
      }
    }

    // Se for categoria AB e for um novo cadastro, pede confirmação
    if (
      formData.intendedCategory === "AB" &&
      !editingRequest &&
      !isABConfirmationOpen
    ) {
      setIsABConfirmationOpen(true);
      return;
    }

    try {
      // Para TODOS os usuários: status determinado pelos 3 checkboxes.
      // Se os 3 estiverem marcados → WAITING_SCHEDULING (Aguardando Agendamento).
      // Se falta algum → IN_ANALYSIS (Candidatos Pendentes).
      const allChecklistsDone =
        !!formData.checklistVehicle &&
        !!formData.practicalCourseInserted &&
        !!formData.taxaPaga;

      const checklistStatus =
        allChecklistsDone
          ? ExamStatus.WAITING_SCHEDULING
          : ExamStatus.IN_ANALYSIS;

      if (editingRequest) {
        // Ao editar: recalcula o status com base nos checkboxes
        // somente enquanto o candidato ainda está pendente (IN_ANALYSIS ou WAITING_SCHEDULING).
        // Candidatos já agendados, concluídos etc. não têm o status alterado pela edição.
        const currentStatus = editingRequest.status;
        const isStillPending =
          currentStatus === ExamStatus.IN_ANALYSIS ||
          currentStatus === ExamStatus.WAITING_SCHEDULING;

        const updatedData: any = { ...formData };
        if (isStillPending) {
          updatedData.status = checklistStatus;
        }
        await api.updateRequest(editingRequest.id, updatedData);
      } else {
        if (formData.intendedCategory === "AB") {
          const instructorParts = (formData.instructor || "").split(" / ");
          const plateParts = (formData.vehiclePlate || "").split(" / ");

          const getVal = (parts: string[], prefix: string) => {
            const part = parts.find((p) => p.trim().startsWith(prefix));
            return part ? part.replace(prefix, "").trim() : "";
          };

          const motoInstructor = getVal(instructorParts, "Moto: ");
          const carInstructor = getVal(instructorParts, "Carro: ");
          const motoPlate = getVal(plateParts, "Moto: ");
          const carPlate = getVal(plateParts, "Carro: ");

          // Create A
          await api.createRequest({
            ...formData,
            intendedCategory: "A",
            instructor: motoInstructor,
            vehiclePlate: motoPlate,
            schoolId: user.schoolId,
            source:
              sourceFilter ||
              (user.role === UserRole.SCHOOL
                ? RequestSource.SCHOOL
                : RequestSource.STUDENT_DIRECT),
            status: checklistStatus,
          });

          // Create B
          await api.createRequest({
            ...formData,
            intendedCategory: "B",
            instructor: carInstructor,
            vehiclePlate: carPlate,
            schoolId: user.schoolId,
            source:
              sourceFilter ||
              (user.role === UserRole.SCHOOL
                ? RequestSource.SCHOOL
                : RequestSource.STUDENT_DIRECT),
            status: checklistStatus,
          });
        } else {
          await api.createRequest({
            ...formData,
            schoolId: user.schoolId,
            source:
              sourceFilter ||
              (user.role === UserRole.SCHOOL
                ? RequestSource.SCHOOL
                : RequestSource.STUDENT_DIRECT),
            status: checklistStatus,
          });
        }
      }
      setIsModalOpen(false);
      fetchRequests(true);
    } catch (err) {
      alert("Erro ao salvar");
    }
  };

  const handleConfirmAttendance = async (id: string) => {
    setConfirmModalData({
      isOpen: true,
      title: "Confirmar Presença",
      message: "Tem certeza que deseja confirmar a presença deste candidato?",
      type: "confirm",
      onConfirm: async () => {
        await api.updateRequest(id, { 
          attendanceConfirmed: true,
          updatedAt: new Date().toISOString()
        });
        fetchRequests(true);
        setConfirmModalData(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleCancelAttendance = async (id: string) => {
    setConfirmModalData({
      isOpen: true,
      title: "Cancelar Presença",
      message: "Tem certeza que deseja cancelar a presença deste candidato? Ele será removido da banca e voltará para o final da fila de agendamento.",
      type: "cancel",
      onConfirm: async () => {
        // Limpa todos os campos de agendamento e queueUpdatedAt para que o
        // candidato vá para o FINAL da fila (updatedAt = now() no backend).
        // Sem limpar queueUpdatedAt o campo ficava "sujo" e poderia restaurar
        // uma posição antiga ao cancelar a banca futuramente.
        await api.updateRequest(id, {
          attendanceConfirmed: false,
          status: ExamStatus.WAITING_SCHEDULING,
          scheduleId: null,
          scheduledDate: null,
          scheduledTime: null,
          scheduledCategory: null,
          examinerId: null,
          queueUpdatedAt: null, // limpa posição salva — updatedAt=now() coloca no final da fila
        } as any);
        fetchRequests(true);
        setConfirmModalData(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleUpdateStatus = async (id: string, status: ExamStatus, skipConfirm = false) => {
    if (!skipConfirm && !window.confirm("Tem certeza que deseja alterar o status?")) return;
    
    const updates: any = { status };
    if (status === ExamStatus.WAITING_SCHEDULING) {
      // updatedAt is set automatically by the backend — places candidate at end of queue
    }
    
    await api.updateRequest(id, updates);
    fetchRequests(true);
  };

  const renderActions = (req: ExamRequest, statusGroup: string) => {
    const isAnalysis = req.status === ExamStatus.IN_ANALYSIS;

    return (
      <div className={`flex items-center space-x-2 ${user.role === UserRole.INSTRUCTOR ? 'w-full' : 'justify-end'}`}>
        {/* Candidatos Pendentes (IN_ANALYSIS): botão Editar para todos os usuários */}
        {isAnalysis && user.role !== UserRole.CONSULTANT && (
          <button
            onClick={() => openCreateModal(req)}
            className="p-1.5 border border-gray-200 rounded hover:bg-gray-100 text-gray-500"
            title="Editar"
          >
            <Edit className="h-4 w-4" />
          </button>
        )}
        {/* Para outros status (não IN_ANALYSIS): manter lógica anterior */}
        {!isAnalysis && user.role !== UserRole.INSTRUCTOR && user.role !== UserRole.CONSULTANT &&
         !(req.status === ExamStatus.WAITING_RESULT && isAdminOpSup) && 
         !(req.status === ExamStatus.DONE && isAdminOpSup) && 
         !(req.status === ExamStatus.CANCELLED && isAdminOpSup) && 
         !(req.status === ExamStatus.WAITING_SCHEDULING && isAdminOpSup) && 
         !(req.status === ExamStatus.SCHEDULED && isAdminOpSup) && (
            <button
              onClick={() => openCreateModal(req)}
              className="p-1.5 border border-gray-200 rounded hover:bg-gray-100 text-gray-500"
              title="Editar"
            >
              <Edit className="h-4 w-4" />
            </button>
        )}

        {statusGroup === "WAITING_CONFIRMATION" &&
          user.role === UserRole.INSTRUCTOR && (
            <div className="flex flex-col gap-2 w-full">
                {(() => {
                  const schedule = schedules.find(s => s.id === req.scheduleId);
                  const dateStr = schedule?.date || req.scheduledDate;
                  const timeStr = schedule?.time || req.scheduledTime;
                  if (dateStr && timeStr) {
                    const examDateTime = new Date(`${dateStr.split('T')[0]}T${timeStr}`);
                    const closingDate = new Date(examDateTime.getTime() - 24 * 60 * 60 * 1000);
                    if (new Date() > closingDate) return null;
                    return (
                      <div className="p-2 bg-orange-50 border border-orange-100 rounded-lg mb-1">
                        <div className="text-[10px] text-orange-500 uppercase font-bold tracking-wider mb-1">Tempo para confirmar:</div>
                        <CountdownTimer 
                          targetDate={closingDate} 
                          onExpire={() => fetchRequests(true)}
                        />
                      </div>
                    );
                  }
                  return (
                    <div className="p-2 bg-orange-50 border border-orange-100 rounded-lg mb-1">
                      <div className="text-[10px] text-orange-500 uppercase font-bold tracking-wider mb-1">Tempo para confirmar:</div>
                      <span className="text-gray-400 text-xs italic">Data não definida</span>
                    </div>
                  );
                })()}
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => handleConfirmAttendance(req.id)}
                  className="flex-1 flex items-center justify-center gap-1 p-2 border border-green-200 rounded-lg hover:bg-green-50 text-green-700 font-bold text-xs transition-colors"
                  title="Confirmar Presença"
                >
                  <Check className="h-4 w-4" /> Confirmar
                </button>
                <button
                  onClick={() => handleCancelAttendance(req.id)}
                  className="flex-1 flex items-center justify-center gap-1 p-2 border border-red-200 rounded-lg hover:bg-red-50 text-red-700 font-bold text-xs transition-colors"
                  title="Cancelar Presença"
                >
                  <Ban className="h-4 w-4" /> Cancelar
                </button>
              </div>
            </div>
          )}

        {/* Aprovar/Recusar removidos do card Candidatos Pendentes conforme solicitado */}

        {req.status === ExamStatus.CANCELLED && isAdminOpSup ? (
          <div className="w-full text-right">
            <span className="text-red-600 font-bold text-xs">
              {req.cancellationReason || "-"}
            </span>
          </div>
        ) : (
          <>
            {(req.status === ExamStatus.DONE || req.status === ExamStatus.WAITING_SCHEDULING || req.status === ExamStatus.SCHEDULED) && isAdminOpSup && (
              <button
                onClick={() => openCreateModal(req)}
                className="p-1.5 border border-blue-200 rounded hover:bg-blue-50 text-blue-600"
                title="Visualizar"
              >
                <Search className="h-4 w-4" />
              </button>
            )}

            {user.role !== UserRole.SCHOOL && (
              <>
                {(req.status === ExamStatus.RETEST) && (
                  <button
                    onClick={() => handleUpdateStatus(req.id, ExamStatus.CANCELLED)}
                    className="p-1.5 border border-red-200 rounded hover:bg-red-50 text-red-600"
                    title="Cancelar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}

                {req.status === ExamStatus.WAITING_RESULT && (user.role === UserRole.ADMIN || user.role === UserRole.SUPERVISOR) && (
                  <button
                    onClick={() => openResultModal(req)}
                    className="px-3 py-1.5 border border-green-200 rounded hover:bg-green-50 text-green-700 text-xs font-bold flex items-center gap-1"
                    title="Lançar Resultado"
                  >
                    <Gavel className="h-3 w-3" /> Resultado
                  </button>
                )}

                {req.status === ExamStatus.DONE && req.result === "INAPTO" && (
                  <button
                    onClick={() => handleUpdateStatus(req.id, ExamStatus.RETEST)}
                    className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 border border-orange-200 text-xs font-bold"
                  >
                    Reteste
                  </button>
                )}

                {/* Excluir: Admin pode excluir candidatos em IN_ANALYSIS e WAITING_SCHEDULING */}
                {user.role === UserRole.ADMIN && !isConsultant && (
                  isAnalysis || req.status === ExamStatus.WAITING_SCHEDULING
                ) && (
                  <button
                    onClick={() => handleDeleteRequest(req.id, req.socialName || req.studentName || undefined)}
                    className="p-1.5 border border-red-200 rounded hover:bg-red-50 text-red-600"
                    title="Excluir Candidato"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}

                {/* Excluir para outros status que já existiam (RETEST, CANCELLED não-análise, etc.) */}
                {user.role === UserRole.ADMIN && !isAnalysis && 
                 req.status !== ExamStatus.WAITING_SCHEDULING && 
                 req.status !== ExamStatus.SCHEDULED && 
                 req.status !== ExamStatus.WAITING_RESULT && 
                 req.status !== ExamStatus.DONE && !isConsultant && (
                  <button
                    onClick={() => handleDeleteRequest(req.id, req.socialName || req.studentName || undefined)}
                    className="p-1.5 border border-red-200 rounded hover:bg-red-50 text-red-600"
                    title="Excluir Candidato"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>
    );
  };

  const handleOpenRejectionModal = (requestId: string) => {
    setRejectionData({ requestId, reason: '' });
    setIsRejectionModalOpen(true);
  };

  const handleSubmitRejection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionData.reason.trim()) {
      alert("Por favor, informe o motivo da recusa.");
      return;
    }
    
    await api.updateRequest(rejectionData.requestId, { 
      status: ExamStatus.CANCELLED,
      cancellationReason: rejectionData.reason 
    });
    
    setIsRejectionModalOpen(false);
    fetchRequests(true);
  };

  const handleDeleteRequest = async (id: string, name?: string) => {
    if (user.role !== UserRole.ADMIN) {
      setErrorMessage("Somente administradores podem excluir candidatos.");
      setErrorField(null);
      setIsErrorModalOpen(true);
      return;
    }
    const displayName = name || "este candidato";
    setConfirmModalData({
      isOpen: true,
      title: "Excluir Candidato",
      message: `Tem certeza que deseja EXCLUIR permanentemente "${displayName}"? Esta ação não pode ser desfeita.`,
      type: "cancel",
      confirmLabel: "Excluir",
      onConfirm: async () => {
        await api.deleteRequest(id);
        setConfirmModalData(prev => ({ ...prev, isOpen: false }));
        fetchRequests(true);
      },
    });
  };

  const doResultSave = async () => {
    if (!editingRequest) return;

    const schedule = schedules.find((s) => s.id === editingRequest.scheduleId);
    const examinerNames = schedule
      ? schedule.examinerIds
          .map((id: string) => examiners.find((e) => e.id === id)?.name)
          .filter(Boolean)
          .join(", ")
      : "";

    const newHistoryEntry = {
      id: "hist_" + Date.now(),
      date:
        schedule?.date ||
        editingRequest.scheduledDate ||
        new Date().toISOString().split("T")[0],
      time:
        schedule?.time ||
        editingRequest.scheduledTime ||
        new Date().toLocaleTimeString().substring(0, 5),
      result: resultData.result,
      category:
        editingRequest.scheduledCategory || editingRequest.intendedCategory,
      examiners: examinerNames,
      observation: resultData.observation,
      scheduleCode: schedule?.code,
      scheduleId: schedule?.id, // New: Link to schedule
    };

    const updatedHistory = [
      ...(editingRequest.examHistory || []),
      newHistoryEntry,
    ];

    // Se Apto -> Realizado (DONE)
    // Se Inapto ou Faltou -> Aguardando Agendamento (WAITING_SCHEDULING)
    const nextStatus =
      resultData.result === "APTO"
        ? ExamStatus.DONE
        : ExamStatus.WAITING_SCHEDULING;

    const updates: any = {
      status: nextStatus,
      result: resultData.result,
      observation: resultData.observation,
      examHistory: updatedHistory,
    };

    // Se voltou para aguardando agendamento, limpa os dados do agendamento anterior
    if (nextStatus === ExamStatus.WAITING_SCHEDULING) {
      // MANTÉM o scheduleId para histórico na banca concluída
      updates.attendanceConfirmed = false;
      // updatedAt is set automatically by the backend — places candidate at end of queue
    }

    await api.updateRequest(editingRequest.id, updates);

    setIsResultModalOpen(false);
    setIsResultConfirmOpen(false);
    fetchRequests(true);
  };

  const handleResultSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResultConfirmOpen(true);
  };

  const openChangeResultModal = (
    requestId: string,
    historyId: string,
    currentResult: string,
  ) => {
    setChangeResultData({ requestId, historyId, currentResult });
    setIsChangeResultModalOpen(true);
  };

  const submitChangeResult = async (newResult: string) => {
    if (!changeResultData) return;
    const { requestId, historyId } = changeResultData;

    const request = requests.find((r) => r.id === requestId);
    if (!request) return;

    const updatedHistory = request.examHistory.map((h) =>
      h.id === historyId ? { ...h, result: newResult as ExamResult } : h,
    );

    await api.updateRequest(requestId, { examHistory: updatedHistory });

    // Update local state for modal if open
    if (editingRequest && editingRequest.id === requestId) {
      setFormData((prev) => ({ ...prev, examHistory: updatedHistory }));
    }

    setIsChangeResultModalOpen(false);
    setChangeResultData(null);
    fetchRequests(true);
  };

  // Helper functions for filtering instructors and vehicles
  const getInstructorsByCategory = (category: "A" | "B") => {
    return instructors.filter((inst) => {
      // Se for instrutor, só pode ver a si mesmo
      if (user.role === UserRole.INSTRUCTOR && user.instructorId) {
        return inst.id === user.instructorId;
      }

      // Se o instrutor não tem categoria definida, assume que pode dar aula em tudo (ou filtrar se tiver lógica mais estrita)
      // Aqui vamos assumir que se tiver vehicles do tipo correspondente, ele serve.
      // Ou se a categoria dele incluir a letra.
      const hasVehicle = inst.vehicles?.some(
        (v) => v.type === (category === "A" ? "MOTO" : "CAR") && v.active,
      );
      const hasCategory =
        inst.category?.includes(category) || inst.category === "AB";
      return hasVehicle || hasCategory;
    });
  };

  const getVehiclesByInstructor = (
    instructorId: string,
    type: "MOTO" | "CAR",
  ) => {
    const instructor = instructors.find((i) => i.id === instructorId);
    if (!instructor) return [];
    return (
      instructor.vehicles?.filter((v) => v.type === type && v.active) || []
    );
  };

  // Renderiza o select de instrutor e veículo para uma categoria específica
  const renderInstructorVehicleSelection = (
    categoryLabel: string,
    categoryCode: "A" | "B",
    colorClass: string,
  ) => {
    const availableInstructors = getInstructorsByCategory(categoryCode);

    // Extrair o ID do instrutor e a placa atual do formData
    // O formato no formData para AB é "Moto: Nome / Carro: Nome" e "Moto: Placa / Carro: Placa"
    // Precisamos parsear isso para saber o valor atual dos selects

    let currentInstructorName = "";
    let currentPlate = "";

    if (formData.intendedCategory === "AB") {
      if (categoryCode === "A") {
        currentInstructorName =
          formData.instructor?.split(" / ")[0]?.replace(/^Moto:\s*/, "") || "";
        currentPlate =
          formData.vehiclePlate?.split(" / ")[0]?.replace(/^Moto:\s*/, "") || "";
      } else {
        currentInstructorName =
          formData.instructor?.split(" / ")[1]?.replace(/^Carro:\s*/, "") || "";
        currentPlate =
          formData.vehiclePlate?.split(" / ")[1]?.replace(/^Carro:\s*/, "") || "";
      }
    } else {
      currentInstructorName = formData.instructor || "";
      currentPlate = formData.vehiclePlate || "";
    }

    // Encontrar o objeto instrutor pelo nome
    const selectedInstructor = instructors.find(
      (i) => i.name === currentInstructorName,
    );
    const availableVehicles = selectedInstructor
      ? getVehiclesByInstructor(
          selectedInstructor.id,
          categoryCode === "A" ? "MOTO" : "CAR",
        )
      : [];

    const selectedVehicle = availableVehicles.find(v => v.plate === currentPlate);

    // "Inserir placa manualmente": controlado por campos especiais no formData.
    // Quando marcado, a placa é digitada livremente.
    // doCandidatoMoto → Cat A, doCandidatoCarro → Cat B
    const flagKey = categoryCode === "A" ? "doCandidatoMoto" : "doCandidatoCarro";
    const isDoCandidato = !!(formData as any)[flagKey];

    // Helper para marcar/desmarcar o checkbox
    const setDoCandidato = (checked: boolean) => {
      if (formData.intendedCategory === "AB") {
        if (categoryCode === "A") {
          const otherPartInstr = formData.instructor?.split(" / ")[1] || "";
          const otherPartPlate = formData.vehiclePlate?.split(" / ")[1] || "";
          setFormData({
            ...formData,
            [flagKey]: checked,
            instructor: `Moto: ${currentInstructorName} / ${otherPartInstr}`,
            vehiclePlate: `Moto: / ${otherPartPlate}`,
          } as any);
        } else {
          const otherPartInstr = formData.instructor?.split(" / ")[0] || "";
          const otherPartPlate = formData.vehiclePlate?.split(" / ")[0] || "";
          setFormData({
            ...formData,
            [flagKey]: checked,
            instructor: `${otherPartInstr} / Carro: ${currentInstructorName}`,
            vehiclePlate: `${otherPartPlate} / Carro: `,
          } as any);
        }
      } else {
        setFormData({ ...formData, [flagKey]: checked, vehiclePlate: "" } as any);
      }
    };

    // Helper para atualizar placa no formData (respeitando formato AB)
    const updatePlate = (newPlate: string) => {
      if (formData.intendedCategory === "AB") {
        const otherPartPlate =
          formData.vehiclePlate?.split(" / ")[categoryCode === "A" ? 1 : 0] || "";
        const finalPlate =
          categoryCode === "A"
            ? `Moto: ${newPlate} / ${otherPartPlate}`
            : `${otherPartPlate} / Carro: ${newPlate}`;
        setFormData({ ...formData, vehiclePlate: finalPlate });
      } else {
        setFormData({ ...formData, vehiclePlate: newPlate });
      }
    };

    return (
      <div className={`p-4 rounded-lg border ${colorClass}`}>
        <h4
          className={`font-bold mb-3 flex items-center gap-2 ${categoryCode === "A" ? "text-blue-800" : "text-green-800"}`}
        >
          {categoryLabel}
        </h4>
        {/* Checkbox "Inserir placa manualmente" para Cat A e Cat B */}
        <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
          <input
            type="checkbox"
            className={`w-4 h-4 cursor-pointer ${categoryCode === "A" ? "accent-blue-600" : "accent-green-600"}`}
            checked={isDoCandidato}
            disabled={isViewOnly}
            onChange={(e) => setDoCandidato(e.target.checked)}
          />
          <span className={`text-sm font-bold ${categoryCode === "A" ? "text-blue-700" : "text-green-700"}`}>Inserir placa manualmente</span>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Instrutor {categoryCode === "A" ? "Moto" : "Carro"}{" "}
              <span className="text-red-500">*</span>
            </label>
            <select
              id={`instructor_${categoryCode}`}
              className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900 disabled:bg-gray-50"
              value={currentInstructorName}
              disabled={user.role === UserRole.INSTRUCTOR || isViewOnly}
              onChange={(e) => {
                const newName = e.target.value;

                // Quando "Inserir placa manualmente" está marcado: só atualiza o instrutor,
                // a placa permanece livre para digitação manual.
                if (isDoCandidato) {
                  if (formData.intendedCategory === "AB") {
                    if (categoryCode === "A") {
                      const otherPartInstr =
                        formData.instructor?.split(" / ")[1] || "";
                      const otherPartPlate =
                        formData.vehiclePlate?.split(" / ")[1] || "";
                      setFormData({
                        ...formData,
                        instructor: `Moto: ${newName} / ${otherPartInstr}`,
                        vehiclePlate: `Moto: ${currentPlate} / ${otherPartPlate}`,
                      } as any);
                    } else {
                      const otherPartInstr =
                        formData.instructor?.split(" / ")[0] || "";
                      const otherPartPlate =
                        formData.vehiclePlate?.split(" / ")[0] || "";
                      setFormData({
                        ...formData,
                        instructor: `${otherPartInstr} / Carro: ${newName}`,
                        vehiclePlate: `${otherPartPlate} / Carro: ${currentPlate}`,
                      } as any);
                    }
                  } else {
                    setFormData({ ...formData, instructor: newName } as any);
                  }
                  return;
                }

                // Comportamento padrão (DO CANDIDATO não marcado)
                let newPlate = "";
                if (newName === "A DEFINIR") {
                  newPlate = "A DEFINIR";
                } else {
                  const newInstructor = instructors.find(
                    (i) => i.name === newName,
                  );
                  const firstVehicle = newInstructor?.vehicles?.find(
                    (v) =>
                      v.type === (categoryCode === "A" ? "MOTO" : "CAR") &&
                      v.active,
                  );
                  newPlate = firstVehicle
                    ? firstVehicle.plate
                    : newInstructor?.category?.includes(categoryCode)
                      ? newInstructor?.plate || ""
                      : "A DEFINIR";
                }

                if (formData.intendedCategory === "AB") {
                  const otherPartInstr =
                    formData.instructor?.split(" / ")[
                      categoryCode === "A" ? 1 : 0
                    ] || "";
                  const otherPartPlate =
                    formData.vehiclePlate?.split(" / ")[
                      categoryCode === "A" ? 1 : 0
                    ] || "";

                  const finalInstr =
                    categoryCode === "A"
                      ? `Moto: ${newName} / ${otherPartInstr}`
                      : `${otherPartInstr} / Carro: ${newName}`;

                  const finalPlate =
                    categoryCode === "A"
                      ? `Moto: ${newPlate} / ${otherPartPlate}`
                      : `${otherPartPlate} / Carro: ${newPlate}`;

                  setFormData({
                    ...formData,
                    instructor: finalInstr,
                    vehiclePlate: finalPlate,
                  });
                } else {
                  setFormData({
                    ...formData,
                    instructor: newName,
                    vehiclePlate: newPlate,
                  });
                }
              }}
            >
              {user.role !== UserRole.INSTRUCTOR && (
                <option value="">Selecione...</option>
              )}
              {availableInstructors.map((inst) => (
                <option key={inst.id} value={inst.name}>
                  {inst.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Veículo/Placa <span className="text-red-500">*</span>
            </label>
            {/* Quando "Inserir placa manualmente" marcado: campo de texto livre para placa */}
            {isDoCandidato ? (
              <input
                type="text"
                className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900 uppercase"
                placeholder="Digite a placa do veículo"
                value={currentPlate}
                onChange={(e) => updatePlate(e.target.value.toUpperCase())}
                maxLength={8}
              />
            ) : (
              <select
                className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900 disabled:bg-gray-50"
                value={currentPlate}
                disabled={isViewOnly || !currentInstructorName}
                onChange={(e) => updatePlate(e.target.value)}
              >
                <option value="">Selecione...</option>
                {availableVehicles.map((v) => (
                  <option key={v.id} value={v.plate}>
                    {v.model} - {v.plate}
                  </option>
                ))}
                {/* Fallback option if instructor has no vehicles list but has a plate property */}
                {selectedInstructor &&
                  !availableVehicles.length &&
                  selectedInstructor.plate &&
                  selectedInstructor.category?.includes(categoryCode) && (
                    <option value={selectedInstructor.plate}>
                      {selectedInstructor.plate}
                    </option>
                  )}
                {/* Allow manual entry if needed or show current value if not in list */}
                {currentPlate &&
                  currentPlate !== "A DEFINIR" &&
                  !availableVehicles.some((v) => v.plate === currentPlate) &&
                  (!selectedInstructor ||
                    selectedInstructor.plate !== currentPlate) && (
                    <option value={currentPlate}>{currentPlate}</option>
                  )}
              </select>
            )}
          </div>
        </div>
        {selectedVehicle && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-1">
            <div className="text-xs text-gray-600">
              <span className="font-bold">Transmissão:</span> {selectedVehicle.transmission === 'AUTOMATICA' ? 'Automática' : selectedVehicle.transmission === 'MANUAL' ? 'Manual' : '-'}
            </div>
            <div className="text-xs text-gray-600">
              <span className="font-bold">Acessórios:</span> {selectedVehicle.accessories?.length ? selectedVehicle.accessories.join(', ') : 'Nenhum'}
            </div>
          </div>
        )}
      </div>
    );
  };

  const openCreateModal = (req?: ExamRequest) => {
    setEditingRequest(req || null);
    setActiveTab("personal");
    if (req) {
      setFormData(req);
    } else {
      const initialData: any = {
        studentName: "",
        cpf: "",
        phone: "",
        examType: typeFilter || ExamType.COMMON,
        intendedCategory: "",
        paidFee: false,
        completedPracticalCourse: false,
        hasVehicle: false,
        practicalHours: 0,
        checklistVehicle: false,
        practicalCourseInserted: false,
        taxaPaga: false,
      };

      // Se for instrutor, já preenche o nome dele
      if (user.role === UserRole.INSTRUCTOR && user.instructorId) {
        const myInstructor = instructors.find(
          (i) => i.id === user.instructorId,
        );
        if (myInstructor) {
          initialData.instructor = myInstructor.name;
          const firstVehicle = myInstructor.vehicles?.find((v) => v.active);
          if (firstVehicle) {
            initialData.vehiclePlate = firstVehicle.plate;
          }
        }
      }

      setFormData(initialData);
    }
    setIsModalOpen(true);
  };

  const openResultModal = (req: ExamRequest) => {
    setEditingRequest(req);
    setResultData({ result: "APTO", observation: "" });
    setIsResultModalOpen(true);
  };

  const toggleGroup = (status: string) => {
    setExpandedGroups((prev) => ({ ...prev, [status]: !prev[status] }));
  };

  // Global queue for WAITING_SCHEDULING to ensure unique positions across all users/schools
  const globalQueue = useMemo(() => {
    return allGlobalRequests
      .filter((r) => {
        if (r.status !== ExamStatus.WAITING_SCHEDULING) return false;
        if (typeFilter && r.examType !== typeFilter) return false;
        // Aplicar o mesmo filtro de módulo para manter posições consistentes
        if (excludeRegularSchools && r.schoolId && r.schoolId !== 'CNH_BRASIL') return false;
        // Excluir vagas automáticas sem candidato real
        const name = r.studentName?.trim();
        const cpf = r.cpf?.replace(/\D/g, '');
        if (!name || name === 'Vaga Disponível' || !cpf || cpf === '00000000000') return false;
        return true;
      })
      .sort(
        (a, b) =>
          new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
      );
  }, [allGlobalRequests, typeFilter, excludeRegularSchools]);

  const getGlobalPosition = (id: string) => {
    const index = globalQueue.findIndex((r) => r.id === id);
    return index !== -1 ? `${index + 1}` : "-";
  };

  const groupRequestsByWeekday = (requests: ExamRequest[]) => {
    const grouped: Record<string, ExamRequest[]> = {
      "Segunda-feira": [],
      "Terça-feira": [],
      "Quarta-feira": [],
      "Quinta-feira": [],
      "Sexta-feira": [],
      "Sábado": [],
      "Domingo": [],
    };

    requests.forEach((req) => {
      const schedule = schedules.find(s => s.id === req.scheduleId);
      const dateStr = schedule?.date || req.scheduledDate;
      if (dateStr) {
        const date = new Date(dateStr + "T00:00:00");
        const day = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
        const weekdaysNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
        const dayName = weekdaysNames[day];
        if (grouped[dayName]) {
          grouped[dayName].push(req);
        }
      }
    });

    return grouped;
  };

  const renderScheduledGroupedByWeekday = (items: ExamRequest[]) => {
    const grouped = groupRequestsByWeekday(items);
    return (
      <div className="p-4 space-y-6 bg-gray-50/50">
        {Object.entries(grouped).filter(([_, items]) => items.length > 0 || !["Sábado", "Domingo"].includes(_)).map(([weekday, dayItems]) => (
          <div key={weekday} className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <button 
              onClick={() => setExpandedWeekdays(prev => ({ ...prev, [weekday]: !prev[weekday] }))}
              className="w-full bg-blue-600 px-4 py-2 flex items-center gap-2 hover:bg-blue-700 transition-colors"
            >
              <Calendar className="h-4 w-4 text-white" />
              <h4 className="text-white font-bold text-sm uppercase tracking-wider">{weekday}</h4>
              <span className="ml-auto bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-bold mr-2">
                {dayItems.length} Candidatos
              </span>
              {expandedWeekdays[weekday] ? (
                <ChevronUp className="h-4 w-4 text-white" />
              ) : (
                <ChevronDown className="h-4 w-4 text-white" />
              )}
            </button>
            {expandedWeekdays[weekday] && (
              <div className="p-0 animate-fadeIn">
                {dayItems.length > 0 ? (
                  <>
                    {/* Mobile View */}
                    <div className="block md:hidden divide-y divide-gray-100">
                      {dayItems.map((req) => (
                        <div key={req.id} className="p-4 bg-white hover:bg-gray-50 transition-colors">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-800 uppercase text-sm">
                                {req.socialName || req.studentName}
                              </span>
                              {req.city && (
                                <span className="text-xs font-medium text-black">
                                  {req.city}
                                </span>
                              )}
                              <span className="text-xs text-gray-500">
                                {maskCpf(req.cpf)}
                              </span>
                              <span className="text-[10px] text-gray-400 mt-0.5">
                                Instr: {req.instructor || "-"}
                              </span>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="font-bold bg-gray-100 px-2 py-1 rounded text-gray-600 text-[10px]">
                                {req.intendedCategory}
                              </span>
                            </div>
                          </div>
                          <div className="text-[10px] text-gray-500 bg-gray-50 p-2.5 rounded-lg">
                            <div className="flex justify-between mt-1">
                              <span>
                                Dados do Exame: {(() => {
                                  const schedule = schedules.find(s => s.id === req.scheduleId);
                                  const dateStr = schedule?.date || req.scheduledDate;
                                  const timeStr = schedule?.time || req.scheduledTime;
                                  const formattedDate = dateStr ? new Date(dateStr.split('T')[0] + 'T00:00:00').toLocaleDateString() : "-";
                                  return `${formattedDate} às ${timeStr || "-"}`;
                                })()}
                              </span>
                              <span>
                                Tentativas: {req.examHistory?.filter(h => h.result === "INAPTO").length || 0}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Desktop View */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-white text-gray-500 border-b">
                          <tr>
                            <th className="px-6 py-3 font-bold text-xs uppercase">Dados do Exame</th>
                            <th className="px-6 py-3 font-bold text-xs uppercase">Candidato</th>
                            <th className="px-6 py-3 font-bold text-xs uppercase">Cidade</th>
                            <th className="px-6 py-3 font-bold text-xs uppercase">Categoria</th>
                            <th className="px-6 py-3 font-bold text-xs uppercase">Histórico</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {dayItems.map((req) => (
                            <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 align-middle text-xs font-bold text-red-600">
                                {(() => {
                                  const schedule = schedules.find(s => s.id === req.scheduleId);
                                  const dateStr = schedule?.date || req.scheduledDate;
                                  const timeStr = schedule?.time || req.scheduledTime;
                                  const formattedDate = dateStr ? new Date(dateStr.split('T')[0] + 'T00:00:00').toLocaleDateString() : "-";
                                  return `${formattedDate} às ${timeStr || "-"}`;
                                })()}
                              </td>
                              <td className="px-6 py-4 align-middle">
                                <div className="flex flex-col">
                                  <span className="font-bold text-gray-800 uppercase">
                                    {req.socialName || req.studentName}
                                  </span>
                                  <span className="text-xs text-gray-700">
                                    CPF: {maskCpf(req.cpf)}
                                  </span>
                                  <span className="text-[10px] text-gray-400 mt-0.5">
                                    Instr: {req.instructor || "-"}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 align-middle text-xs text-black font-medium">
                                {req.city || "-"}
                              </td>
                              <td className="px-6 py-4 align-middle">
                                <span className="font-bold bg-gray-100 px-2 py-1 rounded text-gray-600 text-xs">
                                  {req.intendedCategory}
                                </span>
                              </td>
                              <td className="px-6 py-4 align-middle text-xs text-gray-500">
                                {req.examHistory?.filter(h => h.result === "INAPTO").length || 0} tentativas
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="p-4 text-center text-gray-400 text-xs italic">
                    Nenhum candidato agendado para este dia.
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderInstructorDetails = (req: ExamRequest) => {
    if (!req.instructor || !req.vehiclePlate) return null;

    const allVehicles = instructors.flatMap(i => i.vehicles || []);
    
    const findVehicle = (plate: string) => {
      if (!plate || plate === "A DEFINIR") return null;
      const cleanPlate = plate.replace(/[^A-Z0-9]/g, "");
      return allVehicles.find(v => v.plate.replace(/[^A-Z0-9]/g, "") === cleanPlate);
    };

    if (req.intendedCategory === "AB") {
      const plates = req.vehiclePlate.split(" / ");
      const motoPlate = plates[0]?.replace(/^Moto:\s*/, "");
      const carroPlate = plates[1]?.replace(/^Carro:\s*/, "");
      
      const moto = findVehicle(motoPlate);
      const carro = findVehicle(carroPlate);

      return (
        <div className="flex flex-col gap-1 mt-1">
          <div className="border-l-2 border-blue-200 pl-2">
            <div className="font-bold text-gray-800 text-[10px] uppercase">{req.instructor.split(" / ")[0]}</div>
            <div className="text-[9px] text-gray-500">
              Transmissão: {moto?.transmission === 'AUTOMATICA' ? 'Automática' : moto?.transmission === 'MANUAL' ? 'Manual' : '-'}
            </div>
            <div className="text-[9px] text-gray-500">
              Modelo: {moto?.model || '-'} Placa: {motoPlate || '-'}
            </div>
          </div>
          <div className="border-l-2 border-green-200 pl-2">
            <div className="font-bold text-gray-800 text-[10px] uppercase">{req.instructor.split(" / ")[1]}</div>
            <div className="text-[9px] text-gray-500">
              Transmissão: {carro?.transmission === 'AUTOMATICA' ? 'Automática' : carro?.transmission === 'MANUAL' ? 'Manual' : '-'}
            </div>
            <div className="text-[9px] text-gray-500">
              Modelo: {carro?.model || '-'} Placa: {carroPlate || '-'}
            </div>
          </div>
        </div>
      );
    } else {
      const vehicle = findVehicle(req.vehiclePlate);
      return (
        <div className="flex flex-col mt-1">
          <span className="font-bold text-gray-800 uppercase">{req.instructor}</span>
          <span className="text-[10px] text-gray-500">
            Transmissão: {vehicle?.transmission === 'AUTOMATICA' ? 'Automática' : vehicle?.transmission === 'MANUAL' ? 'Manual' : '-'}
          </span>
          <span className="text-[10px] text-gray-500">
            Modelo: {vehicle?.model || '-'} Placa: {req.vehiclePlate}
          </span>
        </div>
      );
    }
  };

  const filteredRequests = requests.filter(
    (r) =>
      (r.socialName || r.studentName)
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) || r.cpf.includes(searchTerm),
  );

  // Group requests by status
  const groupedRequests = {
    [ExamStatus.IN_ANALYSIS]: filteredRequests.filter(
      (r) => r.status === ExamStatus.IN_ANALYSIS,
    ),
    [ExamStatus.WAITING_SCHEDULING]: filteredRequests.filter(
      (r) => r.status === ExamStatus.WAITING_SCHEDULING,
    ),
    WAITING_CONFIRMATION: filteredRequests.filter(
      (r) => {
        const schedule = schedules.find(s => s.id === r.scheduleId);
        return r.status === ExamStatus.SCHEDULED && !r.attendanceConfirmed && schedule?.status === 'OPEN';
      }
    ),
    [ExamStatus.SCHEDULED]: filteredRequests.filter(
      (r) => {
        if (r.status === ExamStatus.SCHEDULED && (user.role !== UserRole.INSTRUCTOR || r.attendanceConfirmed)) {
          if (user.role === UserRole.INSTRUCTOR) {
            const schedule = schedules.find(s => s.id === r.scheduleId);
            const dateStr = schedule?.date || r.scheduledDate;
            const timeStr = schedule?.time || r.scheduledTime;
            if (dateStr && timeStr) {
              const examDateTime = new Date(`${dateStr}T${timeStr}`);
              const fourHoursLater = new Date(examDateTime.getTime() + 4 * 60 * 60 * 1000);
              if (new Date() > fourHoursLater) {
                return false; // Move to WAITING_RESULT
              }
            }
          }
          return true;
        }
        return false;
      }
    ),
    [ExamStatus.WAITING_RESULT]: filteredRequests.filter(
      (r) => {
        if (r.status === ExamStatus.WAITING_RESULT) return true;
        if (user.role === UserRole.INSTRUCTOR && r.status === ExamStatus.SCHEDULED && r.attendanceConfirmed) {
          const schedule = schedules.find(s => s.id === r.scheduleId);
          const dateStr = schedule?.date || r.scheduledDate;
          const timeStr = schedule?.time || r.scheduledTime;
          if (dateStr && timeStr) {
            const examDateTime = new Date(`${dateStr}T${timeStr}`);
            const fourHoursLater = new Date(examDateTime.getTime() + 4 * 60 * 60 * 1000);
            if (new Date() > fourHoursLater) {
              return true; // Show in WAITING_RESULT
            }
          }
        }
        return false;
      }
    ),
    [ExamStatus.DONE]: filteredRequests.filter(
      (r) => r.status === ExamStatus.DONE,
    ),
    [ExamStatus.CANCELLED]: filteredRequests.filter(
      (r) => r.status === ExamStatus.CANCELLED,
    ),
  };

  // Sort filtered requests for WAITING_SCHEDULING by position (updatedAt ASC — mais antigo = 1º)
  const sortedWaitingScheduling = useMemo(() => {
    return [...groupedRequests[ExamStatus.WAITING_SCHEDULING]].sort((a, b) => {
      const posA = globalQueue.findIndex(r => r.id === a.id);
      const posB = globalQueue.findIndex(r => r.id === b.id);
      // Fallback direto por updatedAt caso o item não esteja na globalQueue
      if (posA === -1 && posB === -1) {
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      }
      if (posA === -1) return 1;
      if (posB === -1) return -1;
      return posA - posB;
    });
  }, [groupedRequests, globalQueue]);

  // Para Admin/Sup/Op: próximo candidato a ser conferido (mais antigo IN_ANALYSIS ainda não conferido).
  // Somente esse ID terá o botão "Conferir" habilitado — os demais ficam desabilitados até que
  // o atual seja Aprovado ou Recusado (o que o remove de IN_ANALYSIS).
  const nextToReviewId = useMemo(() => {
    if (!isAdminOpSup) return null;
    const inAnalysis = [...groupedRequests[ExamStatus.IN_ANALYSIS]]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    // O próximo é o mais antigo que ainda não foi conferido (não está em checkedRequests)
    const notYetChecked = inAnalysis.find(r => !checkedRequests.has(r.id));
    return notYetChecked?.id ?? null;
  }, [groupedRequests, checkedRequests, isAdminOpSup]);

  // Determine visible statuses based on filter
  const allStatuses = [
    ExamStatus.IN_ANALYSIS,
    ExamStatus.WAITING_SCHEDULING,
    ...(user.role === UserRole.INSTRUCTOR ? ["WAITING_CONFIRMATION"] : []),
    ExamStatus.SCHEDULED,
    ExamStatus.WAITING_RESULT,
    ExamStatus.DONE,
    // Card Candidatos Cancelados removido conforme solicitado
  ];

  const visibleStatuses = statusFilter === "ALL" ? allStatuses : [statusFilter];

  const groupConfig = {
    [ExamStatus.IN_ANALYSIS]: {
      label: "Candidatos Pendentes",
      color: "red",
      icon: AlertTriangle,
    },
    [ExamStatus.WAITING_SCHEDULING]: {
      label: "Aguardando Agendamento",
      color: "yellow",
      icon: Clock,
    },
    WAITING_CONFIRMATION: {
      label: "Aguardando Confirmação",
      color: "orange",
      icon: UserCheck,
    },
    [ExamStatus.SCHEDULED]: {
      label: (isAdminOpSup || user.role === UserRole.INSTRUCTOR) ? "Candidatos Agendados" : "Agendado",
      color: "blue",
      icon: Calendar,
    },
    [ExamStatus.WAITING_RESULT]: {
      label: (isAdminOpSup || user.role === UserRole.INSTRUCTOR) ? "Aguardando Resultados" : "Aguardando Resultado",
      color: "purple",
      icon: FileSearch,
    },
    [ExamStatus.DONE]: {
      label: (isAdminOpSup || user.role === UserRole.INSTRUCTOR) ? "Candidatos Aprovados" : "Realizado",
      color: "green",
      icon: CheckCircle,
    },
    [ExamStatus.CANCELLED]: { 
      label: (isAdminOpSup || user.role === UserRole.INSTRUCTOR) ? "Candidatos Cancelados" : "Cancelado", 
      color: "gray", 
      icon: X 
    },
  };

  if (loading)
    return (
      <div className="p-8 text-center text-gray-500">
        Carregando solicitações...
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Header and filters */}
      {user.role === UserRole.INSTRUCTOR ? (
        <div className="flex flex-col gap-4">
          {/* Action Button (Top Centered) */}
          <div className="w-full flex justify-center">
            {!isConsultant && (
              <button
                onClick={() => openCreateModal()}
                className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 flex items-center gap-2 font-bold shadow-sm transition-colors w-full justify-center"
              >
                <Plus className="h-5 w-5" /> Novo Candidato
              </button>
            )}
          </div>

          {/* Search Filter */}
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou CPF..."
              className="w-full pl-10 pr-4 py-3 border rounded-md text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Status Filter */}
          <div className="relative w-full">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <Filter className="h-4 w-4 text-gray-400" />
            </div>
            <select
              className="w-full pl-10 pr-10 py-3 border rounded-md text-sm bg-white text-gray-900 appearance-none focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer shadow-sm"
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
            >
              <option value="ALL">Todos os Status</option>
              <option value={ExamStatus.IN_ANALYSIS}>Candidatos Pendentes</option>
              <option value={ExamStatus.WAITING_SCHEDULING}>Aguardando Agendamento</option>
              <option value={ExamStatus.SCHEDULED}>Candidatos Agendados</option>
              <option value={ExamStatus.WAITING_RESULT}>Aguardando Resultados</option>
              <option value={ExamStatus.DONE}>Candidatos Aprovados</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Filters (Left Side) */}
          <div className="flex gap-3 w-full md:w-auto items-center">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nome ou CPF..."
                className="w-full pl-10 pr-4 py-2 border rounded-md text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="relative w-full md:w-72">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <Filter className="h-4 w-4 text-gray-400" />
              </div>
              <select
                className="w-full pl-10 pr-10 py-2 border rounded-md text-sm bg-white text-gray-900 appearance-none focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer shadow-sm"
                value={statusFilter}
                onChange={(e) => handleStatusFilterChange(e.target.value)}
              >
                <option value="ALL">Todos os Status</option>
                <option value={ExamStatus.IN_ANALYSIS}>
                  {"Candidatos Pendentes"}
                </option>
                <option value={ExamStatus.WAITING_SCHEDULING}>
                  Aguardando Agendamento
                </option>
                <option value={ExamStatus.SCHEDULED}>
                  {isAdminOpSup ? "Candidatos Agendados" : "Agendado"}
                </option>
                <option value={ExamStatus.WAITING_RESULT}>
                  {isAdminOpSup ? "Aguardando Resultados" : "Aguardando Resultado"}
                </option>
                <option value={ExamStatus.DONE}>
                  {isAdminOpSup ? "Candidatos Aprovados" : "Realizado"}
                </option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Action Button (Right Side) */}
          <div className="w-full md:w-auto flex justify-end">
            {!isConsultant && (
              <button
                onClick={() => openCreateModal()}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2 font-medium shadow-sm transition-colors"
              >
                <Plus className="h-4 w-4" /> Novo Candidato
              </button>
            )}
          </div>
        </div>
      )}

      {/* Grupos Expansíveis (Acordeões) */}
      <div className="space-y-4">
        {visibleStatuses.map((status) => {
          const items = status === ExamStatus.WAITING_SCHEDULING ? sortedWaitingScheduling : (groupedRequests as any)[status];
          const config = (groupConfig as any)[status];
          const isExpanded = expandedGroups[status];
          const Icon = config.icon;

          // Tailwind colors mapping
          const bgColors: Record<string, string> = {
            indigo: "bg-indigo-50",
            yellow: "bg-yellow-50",
            orange: "bg-orange-50",
            blue: "bg-blue-50",
            purple: "bg-purple-50",
            green: "bg-green-50",
            red: "bg-red-50",
            gray: "bg-gray-50",
          };
          const textColors: Record<string, string> = {
            indigo: "text-indigo-700",
            yellow: "text-yellow-700",
            orange: "text-orange-700",
            blue: "text-blue-700",
            purple: "text-purple-700",
            green: "text-green-700",
            red: "text-red-700",
            gray: "text-gray-700",
          };
          const borderColors: Record<string, string> = {
            indigo: "border-l-4 border-l-indigo-400",
            yellow: "border-l-4 border-l-yellow-400",
            orange: "border-l-4 border-l-orange-400",
            blue: "border-l-4 border-l-blue-400",
            purple: "border-l-4 border-l-purple-400",
            green: "border-l-4 border-l-green-400",
            red: "border-l-4 border-l-red-400",
            gray: "border-l-4 border-l-gray-400",
          };

          return (
            <div
              key={status}
              className={`bg-white rounded-lg shadow-sm overflow-hidden transition-all ${isExpanded ? "ring-1 ring-black/5" : ""}`}
            >
              <button
                onClick={() => toggleGroup(status)}
                className={`w-full flex items-center justify-between p-5 ${bgColors[config.color]} ${borderColors[config.color]}`}
              >
                <div className="flex items-center gap-4">
                  <Icon className={`h-6 w-6 ${textColors[config.color]}`} />
                  <h3
                    className={`font-bold text-base ${textColors[config.color]}`}
                  >
                    {config.label}
                  </h3>
                  <span className="bg-white px-3 py-1 rounded-full text-sm font-bold text-gray-500 shadow-sm">
                    {items.length}
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-6 w-6 text-gray-400" />
                ) : (
                  <ChevronDown className="h-6 w-6 text-gray-400" />
                )}
              </button>

              {isExpanded && (
                <>
                  {status === ExamStatus.SCHEDULED && isAdminOpSup ? (
                    renderScheduledGroupedByWeekday(items)
                  ) : (
                    <>
                      {/* Mobile View / Cards View */}
                      <div className={`${user.role === UserRole.INSTRUCTOR ? 'p-4 grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 bg-gray-50/50' : 'block md:hidden divide-y divide-gray-100'}`}>
                    {items.map((req: ExamRequest) => {
                      if (user.role === UserRole.INSTRUCTOR) {
                        return (
                          <div key={req.id} className="p-4 bg-white border rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col items-start text-left relative">
                            {status === ExamStatus.CANCELLED ? (
                              <>
                                <div className="font-bold text-gray-800 uppercase text-sm mb-1">
                                  {req.socialName || req.studentName}
                                </div>
                                {req.city && (
                                  <div className="text-sm text-gray-700">
                                    Cidade: {req.city}
                                  </div>
                                )}
                                <div className="text-sm text-gray-700">
                                  Categoria: <span className="text-red-600 font-bold">{req.intendedCategory}</span>
                                </div>
                                <div className="mt-2 w-full pt-2 border-t border-gray-100">
                                  <div className="text-sm text-red-600 font-bold">
                                    Motivo: {req.cancellationReason || "Não informado"}
                                  </div>
                                </div>
                              </>
                            ) : (
                              <>
                                {(status === ExamStatus.WAITING_SCHEDULING || status === ExamStatus.DONE) && (
                                  <button
                                    onClick={() => setHistoryModalData({ isOpen: true, request: req })}
                                    className="absolute top-2 right-2 p-2 text-gray-400 hover:text-blue-600 transition-colors"
                                    title="Ver Histórico"
                                  >
                                    <Search className="h-5 w-5" />
                                  </button>
                                )}
                                {status === ExamStatus.WAITING_SCHEDULING && (
                                  <div className="text-red-600 font-bold mb-1">
                                    Posição: {getGlobalPosition(req.id)}º
                                  </div>
                                )}
                                <div className="font-bold text-gray-800 uppercase text-sm mb-1">
                                  {req.socialName || req.studentName}
                                </div>
                                <div className="text-sm text-gray-700">
                                  CPF: {maskCpf(req.cpf)}
                                </div>
                                {req.city && (
                                  <div className="text-sm text-gray-700">
                                    Cidade: {req.city}
                                  </div>
                                )}
                                <div className="text-sm text-gray-700">
                                  Categoria: <span className="text-red-600 font-bold">{req.intendedCategory}</span>
                                  {(status === "WAITING_CONFIRMATION" || status === ExamStatus.SCHEDULED || status === ExamStatus.DONE || status === ExamStatus.WAITING_SCHEDULING) && (
                                    <span>
                                      {" - Histórico: "}
                                      <span className="text-red-600 font-bold">
                                        {req.examHistory?.filter(h => h.result === "INAPTO").length || 0}
                                      </span>
                                      {" tentativas"}
                                    </span>
                                  )}
                                </div>
                                
                                {status === ExamStatus.WAITING_SCHEDULING && req.cnhRestriction && (
                                  <div 
                                    className="mt-2 bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded cursor-pointer inline-block shadow-sm"
                                    onClick={() => setRestrictionModalData({ isOpen: true, restrictions: req.cnhRestriction! })}
                                  >
                                    Restrição CNH: {req.cnhRestriction}
                                  </div>
                                )}
                                
                                {(status === ExamStatus.IN_ANALYSIS || status === ExamStatus.WAITING_SCHEDULING) && (
                                  <div className="text-xs text-gray-400 mt-1">
                                    Cadastrado em: {new Date(req.createdAt).toLocaleString()}
                                  </div>
                                )}

                                {(status === "WAITING_CONFIRMATION" || status === ExamStatus.SCHEDULED || status === ExamStatus.DONE) && (
                                  <div className="text-sm text-gray-700 mt-1">
                                    Dados do Exame:
                                    <div className="text-red-600 font-bold">
                                      {(() => {
                                        const schedule = schedules.find(s => s.id === req.scheduleId);
                                        const dateStr = schedule?.date || req.scheduledDate;
                                        const timeStr = schedule?.time || req.scheduledTime;
                                        const formattedDate = dateStr ? new Date(dateStr.split('T')[0] + 'T00:00:00').toLocaleDateString() : "-";
                                        return `${formattedDate} às ${timeStr || "-"}`;
                                      })()}
                                    </div>
                                  </div>
                                )}

                                {(status === "WAITING_CONFIRMATION" || status === ExamStatus.SCHEDULED) && req.cnhRestriction && (
                                  <div 
                                    className="mt-2 bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded cursor-pointer inline-block shadow-sm"
                                    onClick={() => setRestrictionModalData({ isOpen: true, restrictions: req.cnhRestriction! })}
                                  >
                                    Restrição CNH: {req.cnhRestriction}
                                  </div>
                                )}

                                {status === "WAITING_CONFIRMATION" && (
                                  <div className="mt-3 w-full pt-3 border-t border-gray-100">
                                    {renderActions(req, status)}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div
                          key={req.id}
                          className="p-4 bg-white hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-800 uppercase text-sm">
                                {req.socialName || req.studentName}
                              </span>
                              {req.city && (
                                <span className={`text-xs font-medium ${status === ExamStatus.IN_ANALYSIS || status === ExamStatus.WAITING_SCHEDULING || status === ExamStatus.SCHEDULED || status === ExamStatus.WAITING_RESULT || status === ExamStatus.DONE || status === ExamStatus.CANCELLED ? 'text-black' : 'text-blue-600'}`}>
                                  {req.city}
                                </span>
                              )}
                              <span className="text-xs text-gray-500">
                                {status === ExamStatus.IN_ANALYSIS || status === ExamStatus.WAITING_SCHEDULING || status === ExamStatus.SCHEDULED || status === ExamStatus.WAITING_RESULT || status === ExamStatus.DONE || status === ExamStatus.CANCELLED ? maskCpf(req.cpf) : req.cpf}
                              </span>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="font-bold bg-gray-100 px-2 py-1 rounded text-gray-600 text-[10px]">
                                {req.intendedCategory}
                              </span>
                              {status === ExamStatus.WAITING_SCHEDULING && (
                                <span className="text-[10px] font-bold text-red-600">
                                  Pos: {getGlobalPosition(req.id)}º
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-[10px] text-gray-500 bg-gray-50 p-2.5 rounded-lg mb-3">
                            {status === ExamStatus.IN_ANALYSIS ? (
                              renderInstructorDetails(req)
                            ) : status !== ExamStatus.SCHEDULED && status !== ExamStatus.WAITING_SCHEDULING ? (
                              <div className="flex justify-between">
                                <span>
                                  Instr:{" "}
                                  <span className="font-medium text-gray-700">
                                    {req.instructor || "-"}
                                  </span>
                                </span>
                                <span>
                                  Placa:{" "}
                                  <span className="font-medium text-gray-700">
                                    {req.vehiclePlate || "-"}
                                  </span>
                                </span>
                              </div>
                            ) : null}
                            {status !== ExamStatus.DONE && status !== ExamStatus.CANCELLED && (
                              <div className="flex justify-between mt-1">
                                <span>
                                  {status === ExamStatus.IN_ANALYSIS || status === ExamStatus.WAITING_SCHEDULING ? "Cadastrado em:" : status === ExamStatus.SCHEDULED ? "Dados do Exame:" : status === ExamStatus.WAITING_RESULT ? "Cadastrado em:" : "Data:"} {
                                    status === ExamStatus.SCHEDULED ? (() => {
                                      const schedule = schedules.find(s => s.id === req.scheduleId);
                                      const dateStr = schedule?.date || req.scheduledDate;
                                      const timeStr = schedule?.time || req.scheduledTime;
                                      const formattedDate = dateStr ? new Date(dateStr.split('T')[0] + 'T00:00:00').toLocaleDateString() : "-";
                                      return `${formattedDate} às ${timeStr || "-"}`;
                                    })() : new Date(req.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                                  }
                                </span>
                                <span>
                                  Tentativas:{" "}
                                  {req.examHistory?.filter(
                                    (h) => h.result === "INAPTO",
                                  ).length || 0}
                                </span>
                              </div>
                            )}
                            {req.result && req.status === ExamStatus.DONE && (
                              <div className="mt-2">
                                <ResultBadge
                                  result={req.result as any}
                                  status={req.status}
                                />
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          {!(status === ExamStatus.SCHEDULED && isAdminOpSup) && (
                            <div className="pt-2 border-t border-gray-100">
                              {renderActions(req, status)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {items.length === 0 && (
                      <div className="p-6 text-center text-gray-400 text-sm">
                        Nenhum candidato nesta situação.
                      </div>
                    )}
                  </div>

                  {/* Desktop View */}
                  <div className={`${user.role === UserRole.INSTRUCTOR ? 'hidden' : 'hidden md:block'} overflow-x-auto`}>
                    <table className="w-full text-sm text-left">
                      <thead className="bg-white text-gray-500 border-b">
                        <tr>
                          {status === ExamStatus.WAITING_SCHEDULING && (
                            <th className="px-6 py-3 font-bold text-xs uppercase w-16 text-center">
                              Posição
                            </th>
                          )}
                          {status === ExamStatus.SCHEDULED && (
                            <th className="px-6 py-3 font-bold text-xs uppercase">
                              Dados do Exame
                            </th>
                          )}
                          {!(status === "WAITING_CONFIRMATION" && user.role === UserRole.INSTRUCTOR) && status !== ExamStatus.SCHEDULED && status !== ExamStatus.WAITING_RESULT && status !== ExamStatus.DONE && status !== ExamStatus.CANCELLED && (
                            <th className="px-6 py-3 font-bold text-xs uppercase">
                              {status === ExamStatus.IN_ANALYSIS || status === ExamStatus.WAITING_SCHEDULING ? "Cadastrado em" : "Data Cadastro"}
                            </th>
                          )}
                          {(status === ExamStatus.IN_ANALYSIS || status === "WAITING_CONFIRMATION") && user.role === UserRole.INSTRUCTOR && (
                            <th className="px-6 py-3 font-bold text-xs uppercase">
                              CPF
                            </th>
                          )}
                          <th className="px-6 py-3 font-bold text-xs uppercase">
                            Candidato
                          </th>
                          {/* Coluna REST.: mostra restrição de CNH para Admin/Sup/Op/Consultor nos cards Aguardando Agendamento e Agendados */}
                          {(status === ExamStatus.WAITING_SCHEDULING || status === ExamStatus.SCHEDULED) && (isAdminOpSup || isConsultant) && (
                            <th className="px-6 py-3 font-bold text-xs uppercase text-center w-20">
                              REST.
                            </th>
                          )}
                          {(status === ExamStatus.SCHEDULED || status === ExamStatus.WAITING_RESULT || status === ExamStatus.DONE) && (
                            <th className="px-6 py-3 font-bold text-xs uppercase">
                              Cidade
                            </th>
                          )}
                          {(status === ExamStatus.IN_ANALYSIS || status === "WAITING_CONFIRMATION") && user.role === UserRole.INSTRUCTOR && (
                            <th className="px-6 py-3 font-bold text-xs uppercase">
                              Cidade
                            </th>
                          )}
                          {!(status === "WAITING_CONFIRMATION" && user.role === UserRole.INSTRUCTOR) && (
                            <th className="px-6 py-3 font-bold text-xs uppercase">
                              Categoria
                            </th>
                          )}
                          {status === "WAITING_CONFIRMATION" && user.role === UserRole.INSTRUCTOR && (
                            <th className="px-6 py-3 font-bold text-xs uppercase">
                              Dados do Exame
                            </th>
                          )}
                          {!((status === ExamStatus.IN_ANALYSIS || status === "WAITING_CONFIRMATION") && user.role === UserRole.INSTRUCTOR) && (
                            <th className="px-6 py-3 font-bold text-xs uppercase">
                              {status === ExamStatus.IN_ANALYSIS ? "Instrutor" : "Histórico"}
                            </th>
                          )}
                          {/* Coluna Pendência: somente no card Candidatos Pendentes */}
                          {status === ExamStatus.IN_ANALYSIS && (
                            <th className="px-6 py-3 font-bold text-xs uppercase text-red-600">
                              Pendência
                            </th>
                          )}
                          {/* Coluna Ações: todos exceto Instructor fora de WAITING_CONFIRMATION e não-Agendados Admin */}
                          {!(status === ExamStatus.SCHEDULED && isAdminOpSup) && (
                            <th className={`px-6 py-3 font-bold text-xs uppercase text-right`}>
                              {status === ExamStatus.CANCELLED ? "Motivo" : "Ações"}
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {items.map((req: ExamRequest) => (
                          <tr
                            key={req.id}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            {status === ExamStatus.WAITING_SCHEDULING && (
                              <td className="px-6 py-4 align-middle text-sm font-bold text-red-600 text-center">
                                {getGlobalPosition(req.id)}º
                              </td>
                            )}
                            {status === ExamStatus.SCHEDULED && (
                              <td className="px-6 py-4 align-middle text-xs font-bold text-red-600">
                                {(() => {
                                  const schedule = schedules.find(s => s.id === req.scheduleId);
                                  const dateStr = schedule?.date || req.scheduledDate;
                                  const timeStr = schedule?.time || req.scheduledTime;
                                  const formattedDate = dateStr ? new Date(dateStr.split('T')[0] + 'T00:00:00').toLocaleDateString() : "-";
                                  return `${formattedDate} às ${timeStr || "-"}`;
                                })()}
                              </td>
                            )}
                            {!(status === "WAITING_CONFIRMATION" && user.role === UserRole.INSTRUCTOR) && status !== ExamStatus.SCHEDULED && status !== ExamStatus.WAITING_RESULT && status !== ExamStatus.DONE && status !== ExamStatus.CANCELLED && (
                              <td className="px-6 py-4 align-middle text-xs text-gray-500">
                                {status === ExamStatus.IN_ANALYSIS || status === ExamStatus.WAITING_SCHEDULING
                                  ? new Date(req.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                                  : new Date(req.createdAt).toLocaleString()}
                                {req.result && req.status === ExamStatus.DONE && (
                                  <div className="mt-1">
                                    <ResultBadge
                                      result={req.result as any}
                                      status={req.status}
                                    />
                                  </div>
                                )}
                              </td>
                            )}
                            {(status === ExamStatus.IN_ANALYSIS || status === "WAITING_CONFIRMATION") && user.role === UserRole.INSTRUCTOR && (
                              <td className="px-6 py-4 align-middle text-xs text-gray-500">
                                {req.cpf}
                              </td>
                            )}
                            <td className="px-6 py-4 align-middle">
                              <div className="flex flex-col">
                                <span className="font-bold text-gray-800 uppercase">
                                  {req.socialName || req.studentName}
                                </span>
                                {status === ExamStatus.IN_ANALYSIS || status === ExamStatus.WAITING_SCHEDULING || status === ExamStatus.SCHEDULED || status === ExamStatus.WAITING_RESULT || status === ExamStatus.DONE || status === ExamStatus.CANCELLED ? (
                                  <>
                                    <span className="text-xs text-gray-700">
                                      CPF: {maskCpf(req.cpf)}
                                    </span>
                                    {req.city && (status === ExamStatus.IN_ANALYSIS || status === ExamStatus.WAITING_SCHEDULING) && (
                                      <span className="text-xs text-black font-medium">
                                        Cidade: {req.city}
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    {!((status === ExamStatus.IN_ANALYSIS || status === "WAITING_CONFIRMATION") && user.role === UserRole.INSTRUCTOR) && req.city && (
                                      <span className="text-xs text-blue-600 font-medium">
                                        {req.city}
                                      </span>
                                    )}
                                    {!((status === ExamStatus.IN_ANALYSIS || status === "WAITING_CONFIRMATION") && user.role === UserRole.INSTRUCTOR) && (
                                      <span className="text-xs text-gray-500">
                                        {req.cpf}
                                      </span>
                                    )}
                                    {!((status === ExamStatus.IN_ANALYSIS || status === "WAITING_CONFIRMATION") && user.role === UserRole.INSTRUCTOR) && (
                                      <span className="text-[10px] text-gray-400 mt-0.5">
                                        Instr: {req.instructor || "-"} | Placa:{" "}
                                        {req.vehiclePlate || "-"}
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                            {/* Célula REST.: restrição de CNH para Admin/Sup/Op/Consultor nos cards Aguardando Agendamento e Agendados */}
                            {(status === ExamStatus.WAITING_SCHEDULING || status === ExamStatus.SCHEDULED) && (isAdminOpSup || isConsultant) && (
                              <td className="px-6 py-4 align-middle text-xs text-center">
                                {req.cnhRestriction ? (
                                  <button
                                    onClick={() => setRestrictionModalData({ isOpen: true, restrictions: req.cnhRestriction! })}
                                    className="font-bold text-orange-600 hover:text-orange-800 hover:underline leading-tight text-center"
                                    title={`Restrições: ${req.cnhRestriction}`}
                                  >
                                    {req.cnhRestriction}
                                  </button>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                            )}
                            {(status === ExamStatus.SCHEDULED || status === ExamStatus.WAITING_RESULT || status === ExamStatus.DONE) && (
                              <td className="px-6 py-4 align-middle text-xs text-black font-medium">
                                {req.city || "-"}
                              </td>
                            )}
                            {(status === ExamStatus.IN_ANALYSIS || status === "WAITING_CONFIRMATION") && user.role === UserRole.INSTRUCTOR && (
                              <td className="px-6 py-4 align-middle text-xs text-gray-500">
                                {req.city || "-"}
                              </td>
                            )}
                            {!(status === "WAITING_CONFIRMATION" && user.role === UserRole.INSTRUCTOR) && (
                              <td className="px-6 py-4 align-middle">
                                <span className="font-bold bg-gray-100 px-2 py-1 rounded text-gray-600 text-xs">
                                  {req.intendedCategory}
                                </span>
                              </td>
                            )}
                            {status === "WAITING_CONFIRMATION" && user.role === UserRole.INSTRUCTOR && (
                              <td className="px-6 py-4 align-middle text-xs font-bold text-red-600">
                                {(() => {
                                  const schedule = schedules.find(s => s.id === req.scheduleId);
                                  const dateStr = schedule?.date || req.scheduledDate;
                                  const timeStr = schedule?.time || req.scheduledTime;
                                  const codeStr = schedule?.code || "-";
                                  const formattedDate = dateStr ? new Date(dateStr.split('T')[0] + 'T00:00:00').toLocaleDateString() : "-";
                                  
                                  return (
                                    <div className="flex flex-col gap-1">
                                      <span>{`${codeStr} - Categoria ${req.scheduledCategory || req.intendedCategory} - ${formattedDate} às ${timeStr || "-"}`}</span>
                                      {dateStr && timeStr && (() => {
                                        const closingDate = new Date(new Date(`${dateStr.split('T')[0]}T${timeStr}`).getTime() - 24 * 60 * 60 * 1000);
                                        if (new Date() > closingDate) return null;
                                        return (
                                          <div className="flex items-center gap-1 bg-orange-50 px-2 py-1 rounded border border-orange-100 w-fit">
                                            <span className="text-[9px] text-orange-400 uppercase tracking-tighter">Expira em:</span>
                                            <CountdownTimer 
                                              targetDate={closingDate} 
                                              onExpire={() => fetchRequests(true)}
                                            />
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  );
                                })()}
                              </td>
                            )}
                            {!((status === ExamStatus.IN_ANALYSIS || status === "WAITING_CONFIRMATION") && user.role === UserRole.INSTRUCTOR) && (
                              <td className="px-6 py-4 align-middle text-xs text-gray-500">
                                {status === ExamStatus.IN_ANALYSIS ? (
                                  renderInstructorDetails(req)
                                ) : (
                                  <>
                                    {req.examHistory?.filter(
                                      (h) => h.result === "INAPTO",
                                    ).length || 0}{" "}
                                    tentativas
                                  </>
                                )}
                              </td>
                            )}
                            {/* Célula Pendência: somente card Candidatos Pendentes */}
                            {status === ExamStatus.IN_ANALYSIS && (
                              <td className="px-6 py-4 align-middle text-xs">
                                {(() => {
                                  const missing: string[] = [];
                                  if (!req.checklistVehicle) missing.push("VEÍCULO");
                                  if (!req.practicalCourseInserted) missing.push("CURSO PRÁTICO");
                                  if (!req.taxaPaga) missing.push("TAXA");
                                  if (missing.length === 0) {
                                    return <span className="text-green-600 font-bold">✓ Completo</span>;
                                  }
                                  return (
                                    <span className="text-red-600 font-bold">
                                      {missing.join(" · ")}
                                    </span>
                                  );
                                })()}
                              </td>
                            )}
                            {/* Ações: todos os usuários (tabela desktop oculta para Instructor) */}
                            {!(status === ExamStatus.SCHEDULED && isAdminOpSup) && (
                              <td className={`px-6 py-4 align-middle text-right`}>
                                {renderActions(req, status)}
                              </td>
                            )}
                          </tr>
                        ))}
                        {items.length === 0 && (
                          <tr>
                            <td
                              colSpan={
                                status === ExamStatus.WAITING_SCHEDULING ? 6 : 5
                              }
                              className="px-6 py-8 text-center text-gray-400 text-sm"
                            >
                              Nenhum candidato nesta situação.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                    </>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Notification Modal */}
      <NotificationModal
        isOpen={isNotificationModalOpen}
        onClose={() => {
          if (notificationData.id) {
            const notifiedIds = JSON.parse(localStorage.getItem(`notified_requests_${user.id}`) || '[]');
            const updatedNotified = Array.from(new Set([...notifiedIds, notificationData.id]));
            localStorage.setItem(`notified_requests_${user.id}`, JSON.stringify(updatedNotified));
          }
          
          setNotificationQueue(prev => prev.slice(1));
          setIsNotificationModalOpen(false);
          setNotificationData({ title: '', message: '', id: '' });
        }}
        title={notificationData.title}
        message={notificationData.message}
      />

      {/* Confirmation Modal */}
      {confirmModalData.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm flex flex-col overflow-hidden animate-fadeIn">
            <div className={`p-4 border-b flex justify-between items-center ${confirmModalData.type === 'confirm' ? 'bg-green-50' : 'bg-red-50'}`}>
              <h3 className={`text-lg font-bold ${confirmModalData.type === 'confirm' ? 'text-green-800' : 'text-red-800'}`}>
                {confirmModalData.title}
              </h3>
              <button
                onClick={() => setConfirmModalData(prev => ({ ...prev, isOpen: false }))}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 text-gray-700 text-sm text-center">
              {confirmModalData.message}
            </div>
            <div className="p-4 border-t bg-gray-50 flex gap-3">
              <button
                onClick={() => setConfirmModalData(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-2.5 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={confirmModalData.onConfirm}
                className={`flex-1 py-2.5 px-4 rounded-lg text-white font-bold transition-colors ${
                  confirmModalData.type === 'confirm' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {confirmModalData.confirmLabel ?? (confirmModalData.type === 'confirm' ? 'Confirmar' : 'Cancelar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restriction Modal */}
      {restrictionModalData.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm flex flex-col overflow-hidden animate-fadeIn">
            <div className="p-4 border-b flex justify-between items-center bg-yellow-50">
              <h3 className="text-lg font-bold text-yellow-800">
                Restrições CNH
              </h3>
              <button
                onClick={() => setRestrictionModalData({ isOpen: false, restrictions: "" })}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 text-gray-700 text-sm">
              <p className="mb-4">O candidato possui as seguintes restrições médicas registradas:</p>
              <div className="font-bold text-lg text-center text-yellow-700 bg-yellow-100 py-3 rounded-lg mb-4">
                {restrictionModalData.restrictions}
              </div>
              <div className="space-y-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
                {restrictionModalData.restrictions.split(', ').map(letter => {
                  const restriction = settings?.restrictions?.find(r => r.code === letter);
                  return (
                    <div key={letter} className="flex gap-2 text-sm">
                      <span className="font-bold text-yellow-800 min-w-[20px]">{letter}:</span>
                      <span className="text-gray-700">{restriction ? restriction.description : "Significado não cadastrado"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-center">
              <button
                onClick={() => setRestrictionModalData({ isOpen: false, restrictions: "" })}
                className="py-2.5 px-6 bg-yellow-500 hover:bg-yellow-600 rounded-lg text-white font-bold transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyModalData.isOpen && historyModalData.request && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden animate-fadeIn max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center bg-blue-50">
              <h3 className="text-lg font-bold text-blue-800 flex items-center gap-2">
                <Search className="h-5 w-5" /> Histórico de Provas
              </h3>
              <button
                onClick={() => setHistoryModalData({ isOpen: false, request: null })}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="mb-6">
                <div className="text-xs text-gray-500 uppercase font-bold mb-1">Candidato</div>
                <div className="text-lg font-bold text-gray-900">{historyModalData.request.socialName || historyModalData.request.studentName}</div>
                <div className="text-sm text-gray-600">CPF: {maskCpf(historyModalData.request.cpf)}</div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-700 border-b pb-2">Tentativas Anteriores</h4>
                {historyModalData.request.examHistory && historyModalData.request.examHistory.length > 0 ? (
                  <div className="space-y-3">
                    {historyModalData.request.examHistory.map((h, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-bold text-gray-500 uppercase">Prova {idx + 1}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            h.result === 'APTO' ? 'bg-green-100 text-green-700' : 
                            h.result === 'INAPTO' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {h.result}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-gray-400">Data:</span> {new Date(h.date).toLocaleDateString()}
                          </div>
                          <div>
                            <span className="text-gray-400">Hora:</span> {h.time || "-"}
                          </div>
                          <div className="col-span-2">
                            <span className="text-gray-400">Examinador:</span> {h.examiners || "Não informado"}
                          </div>
                          <div>
                            <span className="text-gray-400">Categoria:</span> {h.category}
                          </div>
                          <div>
                            <span className="text-gray-400">Resultado:</span> <span className={`font-bold ${h.result === 'APTO' ? 'text-green-600' : 'text-red-600'}`}>{h.result}</span>
                          </div>
                          {h.observation && (
                            <div className="col-span-2 mt-1">
                              <span className="text-gray-400">Obs:</span> {h.observation}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-400 italic text-sm">
                    Nenhum histórico de provas encontrado.
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-center">
              <button
                onClick={() => setHistoryModalData({ isOpen: false, request: null })}
                className="py-2.5 px-8 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-bold transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center md:p-4">
          <div className="bg-white md:rounded-lg shadow-xl w-full h-full md:h-auto md:max-w-2xl flex flex-col md:max-h-[90vh]">
            <div className="p-4 md:p-6 border-b flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">
                {isViewOnly ? "Visualizar Candidato" : editingRequest ? "Editar Candidato" : "Novo Candidato"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b bg-gray-50">
              <button
                className={`flex-1 py-3 text-xs md:text-sm font-bold border-b-2 transition-colors ${activeTab === "personal" ? "border-blue-600 text-blue-600 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                onClick={() => setActiveTab("personal")}
              >
                Dados Pessoais
              </button>
              <button
                className={`flex-1 py-3 text-xs md:text-sm font-bold border-b-2 transition-colors ${activeTab === "exam" ? "border-blue-600 text-blue-600 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                onClick={() => setActiveTab("exam")}
              >
                Dados do Exame
              </button>
              {user.role !== UserRole.INSTRUCTOR && (
                <button
                  className={`flex-1 py-3 text-xs md:text-sm font-bold border-b-2 transition-colors ${activeTab === "history" ? "border-blue-600 text-blue-600 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                  onClick={() => setActiveTab("history")}
                >
                  Histórico
                </button>
              )}
            </div>

            <div className="p-6 overflow-y-auto">
              <form
                id="candidateForm"
                onSubmit={handleSave}
                className="space-y-6"
              >
                {activeTab === "personal" && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          CPF <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="cpf"
                          required
                          className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900 disabled:bg-gray-50"
                          value={formData.cpf || ""}
                          disabled={isViewOnly}
                          onChange={(e) => {
                            const onlyNums = e.target.value.replace(/\D/g, "");
                            setFormData({ ...formData, cpf: onlyNums });
                          }}
                          maxLength={11}
                          placeholder="Somente números"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Nome Completo <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="studentName"
                          required
                          className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900 disabled:bg-gray-50"
                          value={formData.studentName || ""}
                          disabled={isViewOnly}
                          onChange={(e) => {
                            // Remove acentos e converte para maiúsculas
                            const val = e.target.value
                              .normalize("NFD")
                              .replace(/[\u0300-\u036f]/g, "")
                              .toUpperCase();
                            // Opcional: permitir apenas letras e espaços (descomente se necessário)
                            // const cleanVal = val.replace(/[^A-Z ]/g, "");
                            setFormData({ ...formData, studentName: val });
                          }}
                        />
                      </div>
                      {user.role !== UserRole.INSTRUCTOR && (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nome Social
                          </label>
                          <input
                            id="socialName"
                            className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900 disabled:bg-gray-50"
                            value={formData.socialName || ""}
                            disabled={isViewOnly}
                            onChange={(e) => {
                              const val = e.target.value
                                .normalize("NFD")
                                .replace(/[\u0300-\u036f]/g, "")
                                .toUpperCase();
                              setFormData({
                                ...formData,
                                socialName: val,
                              });
                            }}
                          />
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Telefone
                        </label>
                        <input
                          id="phone"
                          className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900 disabled:bg-gray-50"
                          value={formData.phone || ""}
                          disabled={isViewOnly}
                          onChange={(e) => {
                            let val = e.target.value.replace(/\D/g, "");
                            if (val.length > 11) val = val.slice(0, 11);

                            let formatted = val;
                            if (val.length > 10) {
                              formatted = val.replace(
                                /^(\d{2})(\d{5})(\d{4}).*/,
                                "($1) $2-$3"
                              );
                            } else if (val.length > 6) {
                              formatted = val.replace(
                                /^(\d{2})(\d{4})(\d{0,4}).*/,
                                "($1) $2-$3"
                              );
                            } else if (val.length > 2) {
                              formatted = val.replace(
                                /^(\d{2})(\d{0,5}).*/,
                                "($1) $2"
                              );
                            } else if (val.length > 0) {
                              formatted = val.replace(/^(\d*)/, "($1");
                            }

                            setFormData({ ...formData, phone: formatted });
                          }}
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Cidade <span className="text-red-500">*</span>
                        </label>
                        <select
                          id="city"
                          required
                          className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900 disabled:bg-gray-50"
                          value={formData.city || ""}
                          disabled={isViewOnly}
                          onChange={(e) =>
                            setFormData({ ...formData, city: e.target.value })
                          }
                        >
                          <option value="">Selecione...</option>
                          {cities.map((city) => (
                            <option key={city.id} value={city.name}>
                              {city.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      {!typeFilter && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Tipo de Exame
                          </label>
                          <select
                            className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900 disabled:bg-gray-50"
                            value={formData.examType || ExamType.COMMON}
                            disabled={isViewOnly}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                examType: e.target.value as ExamType,
                              })
                            }
                          >
                            <option value={ExamType.COMMON}>
                              1ª Habilitação
                            </option>
                            <option value={ExamType.PCD}>PCD</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "exam" && (
                  <div className="space-y-6 animate-fadeIn">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {(isAdminOpSup || user.role === UserRole.INSTRUCTOR) ? "Categoria" : "Categoria Pretendida"}{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <select
                          id="intendedCategory"
                          required
                          className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900 disabled:bg-gray-50"
                          value={formData.intendedCategory || ""}
                          disabled={!!editingRequest && (user.role === UserRole.ADMIN || user.role === UserRole.OPERATOR || user.role === UserRole.SUPERVISOR)}
                          onChange={(e) => {
                            const newCat = e.target.value;
                            let newInstructor = formData.instructor;
                            let newPlate = formData.vehiclePlate;

                            // Se for instrutor, ao mudar a categoria, garante que o instrutor e placa estão preenchidos corretamente
                            if (
                              user.role === UserRole.INSTRUCTOR &&
                              user.instructorId
                            ) {
                              const myInstructor = instructors.find(
                                (i) => i.id === user.instructorId,
                              );
                              if (myInstructor) {
                                const name = myInstructor.name;
                                const firstMoto = myInstructor.vehicles?.find(
                                  (v) => v.type === "MOTO" && v.active,
                                );
                                const firstCar = myInstructor.vehicles?.find(
                                  (v) => v.type === "CAR" && v.active,
                                );

                                const motoPlate = firstMoto
                                  ? firstMoto.plate
                                  : myInstructor.category?.includes("A")
                                    ? myInstructor.plate
                                    : "A DEFINIR";
                                const carPlate = firstCar
                                  ? firstCar.plate
                                  : myInstructor.category?.includes("B")
                                    ? myInstructor.plate
                                    : "A DEFINIR";

                                if (newCat === "AB") {
                                  newInstructor = `Moto: ${name} / Carro: ${name}`;
                                  newPlate = `Moto: ${motoPlate} / Carro: ${carPlate}`;
                                } else if (newCat === "A") {
                                  newInstructor = name;
                                  newPlate = motoPlate;
                                } else {
                                  newInstructor = name;
                                  newPlate = carPlate;
                                }
                              }
                            }

                            setFormData({
                              ...formData,
                              intendedCategory: newCat,
                              instructor: newInstructor,
                              vehiclePlate: newPlate,
                            });
                          }}
                        >
                          <option value="">Selecione...</option>
                          {(() => {
                            if (user.role === UserRole.INSTRUCTOR && user.instructorId) {
                              const myInstructor = instructors.find(i => i.id === user.instructorId);
                              if (myInstructor) {
                                const hasMoto = myInstructor.vehicles?.some(v => v.type === "MOTO" && v.active) || myInstructor.category?.includes("A");
                                const hasCar = myInstructor.vehicles?.some(v => v.type === "CAR" && v.active) || myInstructor.category?.includes("B");
                                
                                const options = [];
                                if (hasMoto) options.push(<option key="A" value="A">A (Moto)</option>);
                                if (hasCar) options.push(<option key="B" value="B">B (Carro)</option>);
                                if (hasMoto && hasCar) options.push(<option key="AB" value="AB">AB (Carro e Moto)</option>);
                                
                                if (options.length > 0) return options;
                              }
                            }
                            return (
                              <>
                                <option value="A">A (Moto)</option>
                                <option value="B">B (Carro)</option>
                                <option value="AB">AB (Carro e Moto)</option>
                              </>
                            );
                          })()}
                        </select>
                      </div>
                      {user.role !== UserRole.INSTRUCTOR && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Restrição CNH
                          </label>
                          <input
                            className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900 disabled:bg-gray-50"
                            value={formData.cnhRestriction || ""}
                            disabled={isViewOnly}
                            onChange={(e) => {
                              const val = e.target.value;
                              const letters = val
                                .replace(/[^a-zA-Z]/g, "")
                                .toUpperCase();
                              const formatted = letters.split("").join(", ");
                              setFormData({
                                ...formData,
                                cnhRestriction: formatted,
                              });
                            }}
                            placeholder="Ex: A, G..."
                          />
                        </div>
                      )}
                    </div>

                    {(formData.intendedCategory === "A" ||
                      formData.intendedCategory === "AB") &&
                      renderInstructorVehicleSelection(
                        "Categoria A (Moto)",
                        "A",
                        "bg-blue-50 border-blue-100",
                      )}

                    {(formData.intendedCategory === "B" ||
                      formData.intendedCategory === "AB") &&
                      renderInstructorVehicleSelection(
                        "Categoria B (Carro)",
                        "B",
                        "bg-green-50 border-green-100",
                      )}

                    {/* Checklists de pré-agendamento — visível para todos os usuários */}
                    <div className="border-t pt-4">
                        <h4 className="font-bold text-sm mb-3 text-gray-800">
                          Checklists
                        </h4>
                        <div className="flex flex-wrap gap-6">
                          {/* VEÍCULO */}
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              className="w-4 h-4 accent-blue-600 cursor-pointer"
                              checked={!!formData.checklistVehicle}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  checklistVehicle: e.target.checked,
                                })
                              }
                            />
                            <span className="text-sm font-medium text-gray-700">
                              VEÍCULO
                            </span>
                          </label>

                          {/* CURSO PRÁTICO INSERIDO */}
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              className="w-4 h-4 accent-blue-600 cursor-pointer"
                              checked={!!formData.practicalCourseInserted}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  practicalCourseInserted: e.target.checked,
                                })
                              }
                            />
                            <span className="text-sm font-medium text-gray-700">
                              CURSO PRÁTICO INSERIDO
                            </span>
                          </label>

                          {/* TAXA */}
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              className="w-4 h-4 accent-blue-600 cursor-pointer"
                              checked={!!formData.taxaPaga}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  taxaPaga: e.target.checked,
                                })
                              }
                            />
                            <span className="text-sm font-medium text-gray-700">
                              TAXA
                            </span>
                          </label>
                        </div>
                        {/* Aviso de destino da ficha */}
                        <p className="mt-3 text-xs text-gray-500 italic">
                          {formData.checklistVehicle && formData.practicalCourseInserted && formData.taxaPaga
                            ? "✅ Todos os itens marcados — candidato será encaminhado para Aguardando Agendamento."
                            : "⚠️ Preencha todos os itens para encaminhar para Aguardando Agendamento. Itens pendentes enviarão para Candidatos Pendentes."}
                        </p>
                      </div>

                    {formData.examType === ExamType.PCD && (
                      <div className="border-t pt-4">
                        <h4 className="font-bold text-sm mb-3">Dados PCD</h4>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Tipo de Deficiência
                            </label>
                            <input
                              className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900"
                              value={formData.disabilityType || ""}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  disabilityType: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Necessidades Especiais
                            </label>
                            <textarea
                              className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900"
                              value={formData.specialNeeds || ""}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  specialNeeds: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "history" && (
                  <div className="space-y-4 animate-fadeIn">
                    <h4 className="font-bold text-gray-800 mb-2">
                      Histórico de Exames
                    </h4>
                    {formData.examHistory && formData.examHistory.length > 0 ? (
                      <div className="border rounded-lg overflow-x-auto">
                        <table className="w-full text-xs text-left min-w-[500px]">
                          <thead className="bg-gray-50 text-gray-500 font-bold">
                            <tr>
                              <th className="px-3 py-2">Data/Hora</th>
                              <th className="px-3 py-2">Examinadores</th>
                              <th className="px-3 py-2">Cat.</th>
                              <th className="px-3 py-2">Obs.</th>
                              <th className="px-3 py-2">Resultado</th>
                              {(user.role === UserRole.ADMIN ||
                                user.role === UserRole.SUPERVISOR) && (
                                <th className="px-3 py-2 text-right">Ação</th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {formData.examHistory.map((hist, idx) => {
                              const schedule = schedules.find(
                                (s) => s.id === hist.scheduleId,
                              );
                              const displayDate = schedule?.date || hist.date;
                              const displayTime = schedule?.time || hist.time;
                              return (
                                <tr key={idx} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 whitespace-nowrap">
                                    <div className="font-medium">
                                      {displayDate
                                        ? displayDate
                                            .split("-")
                                            .reverse()
                                            .join("/")
                                        : "-"}
                                    </div>
                                    <div className="text-[10px] text-gray-400">
                                      {displayTime}
                                    </div>
                                  </td>
                                  <td
                                    className="px-3 py-2 text-[10px] max-w-[120px] truncate"
                                    title={hist.examiners}
                                  >
                                    {hist.examiners || "-"}
                                  </td>
                                  <td className="px-3 py-2 font-bold">
                                    {hist.category}
                                  </td>
                                  <td
                                    className="px-3 py-2 text-[10px] max-w-[150px] truncate"
                                    title={hist.observation}
                                  >
                                    {hist.observation || "-"}
                                  </td>
                                  <td className="px-3 py-2">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        hist.result === "APTO"
                                          ? "bg-green-100 text-green-700"
                                          : hist.result === "INAPTO"
                                            ? "bg-red-100 text-red-700"
                                            : hist.result === "CANCELADO"
                                              ? "bg-gray-100 text-gray-700"
                                              : "bg-orange-100 text-orange-700"
                                      }`}
                                    >
                                      {hist.result}
                                    </span>
                                  </td>
                                  {(user.role === UserRole.ADMIN ||
                                    user.role === UserRole.SUPERVISOR) && (
                                    <td className="px-3 py-2 text-right">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          editingRequest &&
                                          openChangeResultModal(
                                            editingRequest.id,
                                            hist.id,
                                            hist.result,
                                          )
                                        }
                                        className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                        title="Mudar Resultado"
                                      >
                                        <Edit className="h-3.5 w-3.5" />
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg border border-dashed">
                        Nenhum histórico registrado.
                      </div>
                    )}
                  </div>
                )}
              </form>
            </div>

            <div className="p-4 md:p-6 border-t bg-gray-50 flex justify-end gap-3 mt-auto">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-100 font-medium"
              >
                {isViewOnly ? "Fechar" : "Cancelar"}
              </button>
                {!isViewOnly && !isConsultant && (
                <button
                  type="button"
                  onClick={(e) => {
                    // Se não estiver na última aba, avança. Se estiver, submete.
                    // Mas o usuário pediu abas para navegar, então o botão Salvar deve estar sempre disponível ou apenas no final?
                    // O padrão geralmente é Salvar disponível sempre.
                    handleSave(e as any);
                  }}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700 shadow-sm transition-all"
                >
                  Salvar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Result Modal */}
      {isResultModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold mb-3">Lançar Resultado</h3>
            {editingRequest && (
              <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-0.5">
                <div className="text-sm font-bold text-gray-800 uppercase">{editingRequest.socialName || editingRequest.studentName}</div>
                <div className="text-xs text-gray-500">CPF: {maskCpf(editingRequest.cpf)}</div>
              </div>
            )}
            <form onSubmit={handleResultSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Resultado Final
                </label>
                <select
                  className="w-full border rounded p-2 font-bold bg-white text-gray-900"
                  value={resultData.result}
                  onChange={(e) =>
                    setResultData({
                      ...resultData,
                      result: e.target.value as ExamResult,
                    })
                  }
                >
                  <option value="APTO">APTO</option>
                  <option value="INAPTO">INAPTO</option>
                  <option value="FALTOU">FALTOU</option>
                  <option value="CANCELADO">CANCELADO</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Observações
                </label>
                <textarea
                  className="w-full border rounded p-2 bg-white text-gray-900"
                  rows={3}
                  value={resultData.observation}
                  onChange={(e) =>
                    setResultData({
                      ...resultData,
                      observation: e.target.value,
                    })
                  }
                ></textarea>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setIsResultModalOpen(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700"
                >
                  Confirmar Resultado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR LANÇAMENTO DE RESULTADO */}
      {isResultConfirmOpen && editingRequest && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="bg-green-100 p-3 rounded-full">
                <Gavel className="h-7 w-7 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-800">Confirmar Resultado</h3>
              <p className="text-sm text-gray-500">Confirme o lançamento do resultado para o candidato abaixo:</p>
              <div className="w-full bg-gray-50 border border-gray-200 rounded-lg p-4 text-left space-y-1 mt-1">
                <div className="text-sm font-bold text-gray-800 uppercase">{editingRequest.socialName || editingRequest.studentName}</div>
                <div className="text-xs text-gray-500">CPF: {maskCpf(editingRequest.cpf)}</div>
                <div className="text-xs text-gray-500 mt-2">Resultado: <span className={`font-bold ${resultData.result === 'APTO' ? 'text-green-600' : resultData.result === 'INAPTO' || resultData.result === 'FALTOU' ? 'text-red-600' : 'text-gray-600'}`}>{resultData.result}</span></div>
                {resultData.observation && <div className="text-xs text-gray-400 mt-0.5">Obs: {resultData.observation}</div>}
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsResultConfirmOpen(false)}
                className="px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-100 font-medium text-sm"
              >
                Voltar
              </button>
              <button
                onClick={doResultSave}
                className="px-6 py-2 bg-green-600 text-white rounded-md font-bold hover:bg-green-700 shadow-sm text-sm"
              >
                Salvar Resultado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Result Modal */}
      {isChangeResultModalOpen && changeResultData && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 relative">
            <div className="flex flex-col items-center">
              <div className="mb-4 p-3 rounded-full bg-blue-50">
                <Gavel className="h-10 w-10 text-blue-500" />
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">
                Alterar Resultado
              </h3>
              <div className="text-gray-500 mb-6 text-center text-sm">
                Selecione o novo resultado para esta tentativa.
              </div>

              <div className="w-full space-y-3 mb-6">
                {["APTO", "INAPTO", "FALTOU", "CANCELADO"].map((res) => (
                  <button
                    key={res}
                    onClick={() => submitChangeResult(res)}
                    className={`w-full py-3 px-4 rounded-lg font-bold border-2 transition-all ${
                      changeResultData.currentResult === res
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {res}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setIsChangeResultModalOpen(false)}
                className="w-full py-2.5 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* AB Confirmation Modal */}
      {isABConfirmationOpen && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 relative">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 p-3 rounded-full bg-blue-50">
                <AlertOctagon className="h-10 w-10 text-blue-500" />
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Confirmação
              </h3>
              <div className="text-gray-600 mb-6">
                Ao selecionar a categoria <strong>AB</strong>, o sistema criará
                automaticamente <strong>dois cadastros separados</strong>: um
                para a categoria A (Moto) e outro para a categoria B (Carro).
              </div>

              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setIsABConfirmationOpen(false)}
                  className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={(e) => {
                    // Continua o salvamento
                    handleSave(e as any);
                    setIsABConfirmationOpen(false);
                  }}
                  className="flex-1 py-2.5 px-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {isErrorModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 relative">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 p-3 rounded-full bg-red-50">
                <AlertOctagon className="h-10 w-10 text-red-500" />
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-2">Atenção</h3>
              <div className="text-gray-600 mb-6">{errorMessage}</div>

              <button
                onClick={() => {
                  setIsErrorModalOpen(false);
                  if (errorField) {
                    // Se o campo estiver em outra aba, muda a aba
                    if (["cpf", "studentName", "phone", "city"].includes(errorField)) {
                      setActiveTab("personal");
                    } else if (
                      [
                        "intendedCategory",
                        "instructor_A",
                        "instructor_B",
                      ].includes(errorField)
                    ) {
                      setActiveTab("exam");
                    }

                    // Foca no campo após um pequeno delay para garantir que a aba trocou
                    // Para "city" (select) usamos delay maior para garantir que o DOM renderizou
                    const focusDelay = errorField === "city" ? 200 : 100;
                    setTimeout(() => {
                      const element = document.getElementById(errorField);
                      if (element) {
                        element.focus();
                        element.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                      }
                    }, focusDelay);
                  }
                }}
                className="w-full py-2.5 px-4 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {isRejectionModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 relative">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 p-3 rounded-full bg-red-50">
                <Ban className="h-10 w-10 text-red-500" />
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-2">Recusar Candidato</h3>
              <div className="text-gray-600 mb-6">Informe o motivo pelo qual este cadastro está sendo recusado.</div>

              <form onSubmit={handleSubmitRejection} className="w-full space-y-4">
                <textarea
                  required
                  className="w-full border rounded-lg p-3 bg-white text-gray-900 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                  rows={4}
                  placeholder="Ex: Documentação incompleta, foto ilegível..."
                  value={rejectionData.reason}
                  onChange={(e) => setRejectionData({ ...rejectionData, reason: e.target.value })}
                ></textarea>

                <div className="flex gap-3 w-full">
                  <button
                    type="button"
                    onClick={() => setIsRejectionModalOpen(false)}
                    className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-4 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Confirmar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {isApprovalModalOpen && approvalData && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 relative">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 p-3 rounded-full bg-green-50">
                <CheckCircle className="h-10 w-10 text-green-500" />
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-2">Aprovar Candidato?</h3>
              <div className="text-gray-600 mb-6">
                Deseja aprovar o cadastro de <span className="font-bold text-gray-800">{approvalData.socialName || approvalData.studentName}</span>?
                <br />
                Ele será movido para a fila de agendamento.
              </div>

              <div className="flex gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setIsApprovalModalOpen(false)}
                  className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    handleUpdateStatus(approvalData.id, ExamStatus.WAITING_SCHEDULING, true);
                    setIsApprovalModalOpen(false);
                  }}
                  className="flex-1 py-2.5 px-4 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestManager;
