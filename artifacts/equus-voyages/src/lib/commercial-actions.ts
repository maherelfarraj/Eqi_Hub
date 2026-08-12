export const PAYMENT_SERVICE_PENDING = "payment_service_pending" as const;

export function paymentServicePendingError() {
  return new Error(PAYMENT_SERVICE_PENDING);
}
