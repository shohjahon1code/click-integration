export interface ClickConfig {
  serviceId: string;
  merchantId: string;
  secretKey: string;
  returnUrl?: string;
  validate: {
    // Function to check if order exists and get its amount
    checkOrder: (orderId: string) => Promise<{ exists: boolean; amount?: number }>;
    // Function to check if payment was already made
    checkPayment?: (orderId: string) => Promise<boolean>;
  };
  handle: {
    // Save prepare info and return prepare_id
    onPrepare: (data: {
      click_trans_id: number;
      merchant_trans_id: string;
      amount: number;
    }) => Promise<{ prepare_id: string | number }>;
    // Handle successful payment
    onSuccess: (data: {
      click_trans_id: number;
      merchant_trans_id: string;
      merchant_prepare_id: string;
    }) => Promise<void>;
    // Handle failed/cancelled payment
    onFail?: (data: {
      click_trans_id: number;
      merchant_trans_id: string;
      error: number;
      error_note: string;
    }) => Promise<void>;
  };
}

export interface ClickRequestDTO {
  click_trans_id: number;
  service_id: string;
  click_paydoc_id: string;
  merchant_trans_id: string;
  merchant_prepare_id: string;
  amount: number;
  action: number;
  error: string;
  error_note: string;
  sign_time: string;
  sign_string: string;
  click_paydoc_type: string;
}

export interface ClickPrepareResponse {
  click_trans_id: number;
  merchant_trans_id: string;
  merchant_prepare_id: string | number;
  error: number;
  error_note: string;
}

export interface ClickCompleteResponse {
  click_trans_id: number;
  merchant_trans_id: string;
  error: number;
  error_note: string;
}

export enum ClickError {
  Success = 0,
  SignFailed = -1,
  InvalidAmount = -2,
  ActionNotFound = -3,
  AlreadyPaid = -4,
  UserNotFound = -5,
  TransactionNotFound = -6,
  TransactionCanceled = -7,
}

export enum TransactionActions {
  Prepare = 0,
  Complete = 1,
}
