import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { requireOrganizationId, useQuery } from "./_shared";

const nullableDate = z.string().nullable();

const financialBalanceSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/),
  outstandingBalance: z.number().int().nonnegative(),
  overdueAmount: z.number().int().nonnegative(),
  nextPaymentDate: nullableDate,
});

const familyOperationsSchema = z.object({
  riders: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      relationship: z.string(),
      relationshipStatus: z.string(),
      membershipStatus: z.string(),
      packageName: z.string(),
      renewalDate: nullableDate,
      creditsRemaining: z.number().int().nonnegative(),
      waitlistCount: z.number().int().nonnegative(),
      financialAccess: z.boolean(),
      financials: z.array(
        financialBalanceSchema.extend({
          paymentLinkStatus: z.string(),
        }),
      ),
    }),
  ),
  familySummary: z.object({
    balances: z.array(financialBalanceSchema),
  }),
});

const revenueOperationsSchema = z.object({
  summaries: z.array(
    z.object({
      currency: z.string().regex(/^[A-Z]{3}$/),
      collectedThisPeriod: z.number().int().nonnegative(),
      outstanding: z.number().int().nonnegative(),
      overdue: z.number().int().nonnegative(),
      activeMemberships: z.number().int().nonnegative(),
      renewalsNext30Days: z.number().int().nonnegative(),
      highRiskRenewals: z.number().int().nonnegative(),
    }),
  ),
  renewals: z.array(
    z.object({
      riderName: z.string(),
      packageName: z.string(),
      renewalDate: z.string(),
      riskLevel: z.enum(["low", "medium", "high"]),
      reason: z.string(),
    }),
  ),
  collections: z.array(
    z.object({
      invoiceNumber: z.string(),
      riderName: z.string(),
      amount: z.number().int().nonnegative(),
      currency: z.string().regex(/^[A-Z]{3}$/),
      daysOverdue: z.number().int().nonnegative(),
      status: z.string(),
      paymentLinkStatus: z.string(),
    }),
  ),
});

export type FamilyOperationsData = z.infer<typeof familyOperationsSchema>;
export type FamilyRider = FamilyOperationsData["riders"][number];
export type RevenueOperationsData = z.infer<typeof revenueOperationsSchema>;
export type RevenueSummary = RevenueOperationsData["summaries"][number];
export type RenewalSignal = RevenueOperationsData["renewals"][number];
export type CollectionCase = RevenueOperationsData["collections"][number];

export type Batch8Data<T extends "family" | "revenue"> = T extends "family"
  ? FamilyOperationsData
  : RevenueOperationsData;

type Batch8QueryResult<T extends "family" | "revenue"> = {
  organizationId: string | null;
  enabled: boolean;
  data: Batch8Data<T> | null;
  loadError: string | null;
};

function errorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Something went wrong";
}

export const batch8ClientEnabled =
  import.meta.env.VITE_BATCH8_ENABLED === "true";

export function useBatch8Operations<T extends "family" | "revenue">(
  surface: T,
) {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id ?? null;
  const query = useQuery<Batch8QueryResult<T>>(
    async () => {
      if (!batch8ClientEnabled || !organizationId) {
        return {
          organizationId,
          enabled: false,
          data: null,
          loadError: null,
        };
      }
      const scopedOrganizationId = requireOrganizationId(organizationId);

      try {
        const { data: availability, error: availabilityError } =
          await supabase.rpc("get_batch8_availability", {
            p_organization_id: scopedOrganizationId,
          });
        if (availabilityError) throw availabilityError;
        if (availability !== true) {
          return {
            organizationId: scopedOrganizationId,
            enabled: false,
            data: null,
            loadError: null,
          };
        }

        const rpcName =
          surface === "family"
            ? "get_batch8_family_operations"
            : "get_batch8_revenue_operations";
        const { data, error } = await supabase.rpc(rpcName, {
          p_organization_id: scopedOrganizationId,
        });
        if (error) throw error;

        const parsed =
          surface === "family"
            ? familyOperationsSchema.parse(data)
            : revenueOperationsSchema.parse(data);
        return {
          organizationId: scopedOrganizationId,
          enabled: true,
          data: parsed as Batch8Data<T>,
          loadError: null,
        };
      } catch (error) {
        return {
          organizationId: scopedOrganizationId,
          enabled: true,
          data: null,
          loadError: errorMessage(error),
        };
      }
    },
    [organizationId, surface],
    { resetOnChange: true },
  );

  const resultMatchesOrganization =
    query.data?.organizationId === organizationId;
  const waitingForOrganization =
    batch8ClientEnabled &&
    Boolean(organizationId) &&
    !resultMatchesOrganization;

  return {
    ...query,
    data: resultMatchesOrganization ? (query.data?.data ?? null) : null,
    loading: waitingForOrganization || query.loading,
    error: resultMatchesOrganization
      ? (query.data?.loadError ?? query.error)
      : null,
    enabled:
      batch8ClientEnabled &&
      Boolean(organizationId) &&
      (!resultMatchesOrganization || query.data?.enabled === true),
  };
}