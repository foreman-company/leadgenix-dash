import { useQuery } from "@tanstack/react-query";
import { fetchContacts, fetchDeals } from "../services/hubspot.js";

export const hubspotKeys = {
  all: ["hubspot"],
  contacts: (token) => [...hubspotKeys.all, "contacts", token],
  deals: (token) => [...hubspotKeys.all, "deals", token],
};

export function useContacts(accessToken, { limit = 10 } = {}) {
  return useQuery({
    queryKey: [...hubspotKeys.contacts(accessToken), limit],
    queryFn: () => fetchContacts(accessToken, { limit }),
    enabled: Boolean(accessToken),
    staleTime: 60_000,
  });
}

export function useDeals(accessToken, { limit = 10 } = {}) {
  return useQuery({
    queryKey: [...hubspotKeys.deals(accessToken), limit],
    queryFn: () => fetchDeals(accessToken, { limit }),
    enabled: Boolean(accessToken),
    staleTime: 60_000,
  });
}
