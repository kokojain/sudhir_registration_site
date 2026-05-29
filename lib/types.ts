export type AppRole = "admin" | "staff";

export type AuthUserContext = {
  userId: string;
  organizationId: string;
  role: AppRole;
  fullName: string | null;
  email: string | null;
};

export type ScanResultStatus =
  | "ALLOWED"
  | "DUPLICATE"
  | "NOT_ELIGIBLE"
  | "NOT_REGISTERED"
  | "INVALID"
  | "ERROR";

export type ScanResult = {
  status: ScanResultStatus;
  message: string;
  delegateId: string;
  name: string;
  category: string;
  timestamp: string;
};
