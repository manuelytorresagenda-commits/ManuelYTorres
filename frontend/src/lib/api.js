import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  headers: { "Content-Type": "application/json" },
});

// Autenticación & PINs
export const verifyPin = (pin) => api.post("/auth/verify-pin", { pin });
export const verifyMasterPin = (pin) => api.post("/auth/verify-master-pin", { pin });
export const specialistLogin = (access_code) => api.post("/auth/specialist-login", { access_code }).then((r) => r.data);

// Sucursales
export const fetchBranches = () => api.get("/branches").then((r) => r.data);
export const createBranch = (data) => api.post("/branches", data).then((r) => r.data);
export const updateBranch = (id, data) => api.put(`/branches/${id}`, data).then((r) => r.data);
export const deleteBranch = (id) => api.delete(`/branches/${id}`).then((r) => r.data);
export const verifyBranchPin = (id, pin) => api.post(`/branches/${id}/verify-pin`, { pin }).then((r) => r.data);
export const updateBranchPin = (id, pin) => api.patch(`/branches/${id}/pin`, { pin }).then((r) => r.data);

// Especialistas
export const fetchSpecialists = (params = {}) => api.get("/specialists", { params }).then((r) => r.data);
export const createSpecialist = (data) => api.post("/specialists", data).then((r) => r.data);
export const updateSpecialist = (id, data) => api.put(`/specialists/${id}`, data).then((r) => r.data);
export const deleteSpecialist = (id) => api.delete(`/specialists/${id}`).then((r) => r.data);

// Recepcionistas (NUEVO)
export const fetchReceptionists = (params = {}) => api.get("/receptionists", { params }).then((r) => r.data);
export const createReceptionist = (data) => api.post("/receptionists", data).then((r) => r.data);
export const updateReceptionist = (id, data) => api.put(`/receptionists/${id}`, data).then((r) => r.data);
export const deleteReceptionist = (id) => api.delete(`/receptionists/${id}`).then((r) => r.data);

// Servicios
export const fetchServices = (params = {}) => api.get("/services", { params }).then((r) => r.data);
export const createService = (data) => api.post("/services", data).then((r) => r.data);
export const updateService = (id, data) => api.put(`/services/${id}`, data).then((r) => r.data);
export const deleteService = (id) => api.delete(`/services/${id}`).then((r) => r.data);

// Citas
export const fetchAppointments = (params = {}) => api.get("/appointments", { params }).then((r) => r.data);
export const createAppointment = (data) => api.post("/appointments", data).then((r) => r.data);
export const updateAppointment = (id, data) => api.put(`/appointments/${id}`, data).then((r) => r.data); // NUEVO: Para editar datos de la cita
export const updateAppointmentStatus = (id, status) => api.patch(`/appointments/${id}`, { status }).then((r) => r.data);
export const updateAppointmentExtras = (id, additional_services) => api.patch(`/appointments/${id}`, { additional_services }).then((r) => r.data);
export const rescheduleAppointment = (id, data) => api.post(`/appointments/${id}/reschedule`, data).then((r) => r.data);
export const deleteAppointment = (id) => api.delete(`/appointments/${id}`).then((r) => r.data);

// Clientes
export const fetchClients = (q) => api.get("/clients", { params: q ? { q } : {} }).then((r) => r.data);
export const createClient = (data) => api.post("/clients", data).then((r) => r.data);

// Vacaciones / Ausencias
export const fetchVacations = (params = {}) => api.get("/vacations", { params }).then((r) => r.data);
export const createVacation = (data) => api.post("/vacations", data).then((r) => r.data);
export const deleteVacation = (id) => api.delete(`/vacations/${id}`).then((r) => r.data);
export const deleteVacationDay = (id, date) =>
  api.delete(`/vacations/${id}/single-day`, { params: { date } }).then((r) => r.data);
