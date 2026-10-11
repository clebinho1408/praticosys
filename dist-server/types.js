export var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "ADMIN";
    UserRole["SUPERVISOR"] = "SUPERVISOR";
    UserRole["OPERATOR"] = "OPERATOR";
    UserRole["CONSULTANT"] = "CONSULTANT";
    UserRole["SCHOOL"] = "SCHOOL";
    UserRole["EXAMINER"] = "EXAMINER";
    UserRole["INSTRUCTOR"] = "INSTRUCTOR";
})(UserRole || (UserRole = {}));
export var ExamType;
(function (ExamType) {
    ExamType["COMMON"] = "COMMON";
    ExamType["PCD"] = "PCD";
})(ExamType || (ExamType = {}));
export var RequestSource;
(function (RequestSource) {
    RequestSource["STUDENT_DIRECT"] = "STUDENT_DIRECT";
    RequestSource["SCHOOL"] = "SCHOOL";
})(RequestSource || (RequestSource = {}));
export var RequestType;
(function (RequestType) {
    RequestType["FIXA"] = "FIXA";
    RequestType["EXTRA"] = "EXTRA";
    RequestType["REPOSICAO"] = "REPOSICAO";
})(RequestType || (RequestType = {}));
export var ExamStatus;
(function (ExamStatus) {
    ExamStatus["IN_ANALYSIS"] = "IN_ANALYSIS";
    ExamStatus["WAITING_SCHEDULING"] = "WAITING_SCHEDULING";
    ExamStatus["SCHEDULED"] = "SCHEDULED";
    ExamStatus["WAITING_RESULT"] = "WAITING_RESULT";
    ExamStatus["RETEST"] = "RETEST";
    ExamStatus["DONE"] = "DONE";
    ExamStatus["CANCELLED"] = "CANCELLED"; // Cancelado
})(ExamStatus || (ExamStatus = {}));
