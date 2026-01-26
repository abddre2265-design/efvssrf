import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { InvoiceRequest } from '@/components/invoice-requests/types';

export interface LookedUpClient {
  id: string;
  client_type: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  identifier_type: string;
  identifier_value: string;
  country: string;
  governorate: string | null;
  address: string | null;
  postal_code: string | null;
  phone_prefix: string | null;
  phone: string | null;
  whatsapp_prefix: string | null;
  whatsapp: string | null;
  email: string | null;
}

export interface PendingClientData {
  client_type: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  identifier_type: string;
  identifier_value: string;
  country: string;
  governorate: string | null;
  address: string | null;
  postal_code: string | null;
  phone_prefix: string | null;
  phone: string | null;
  whatsapp_prefix: string | null;
  whatsapp: string | null;
  email: string | null;
}

export interface ClientLookupResult {
  found: boolean;
  client: LookedUpClient | null;
  pendingClient: PendingClientData | null;
  isNewClient: boolean;
}

/**
 * Hook for client lookup and lazy creation from invoice requests.
 * 
 * Search criteria:
 * 1. Client name or company name match
 * 2. OR first 6 characters of identifier match
 * 
 * If client found: auto-assign to form, user can modify/replace
 * If not found: create pending client data (only saved to DB on invoice validation)
 */
export const useClientLookup = (organizationId: string | null) => {
  const [isLooking, setIsLooking] = useState(false);
  const [lookupResult, setLookupResult] = useState<ClientLookupResult | null>(null);

  /**
   * Look up client by request data
   */
  const lookupClientFromRequest = useCallback(async (request: InvoiceRequest): Promise<ClientLookupResult> => {
    if (!organizationId) {
      return { found: false, client: null, pendingClient: null, isNewClient: false };
    }

    setIsLooking(true);

    try {
      // If request already has a linked client, use it directly
      if (request.linked_client_id) {
        const { data: existingClient } = await supabase
          .from('clients')
          .select('*')
          .eq('id', request.linked_client_id)
          .maybeSingle();

        if (existingClient) {
          const result: ClientLookupResult = {
            found: true,
            client: existingClient as LookedUpClient,
            pendingClient: null,
            isNewClient: false,
          };
          setLookupResult(result);
          return result;
        }
      }

      // Search criteria 1: By client name or company name
      const clientName = request.company_name || 
        `${request.first_name || ''} ${request.last_name || ''}`.trim();
      
      // Search criteria 2: First 6 characters of identifier
      const identifierPrefix = request.identifier_value?.substring(0, 6) || '';

      let foundClient: LookedUpClient | null = null;

      // Search by company name (exact match, case insensitive)
      if (request.company_name) {
        const { data } = await supabase
          .from('clients')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('status', 'active')
          .ilike('company_name', request.company_name)
          .maybeSingle();

        if (data) foundClient = data as LookedUpClient;
      }

      // If not found by company name, search by first + last name
      if (!foundClient && request.first_name && request.last_name) {
        const { data } = await supabase
          .from('clients')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('status', 'active')
          .ilike('first_name', request.first_name)
          .ilike('last_name', request.last_name)
          .maybeSingle();

        if (data) foundClient = data as LookedUpClient;
      }

      // If still not found, search by identifier prefix (first 6 chars)
      if (!foundClient && identifierPrefix.length >= 6) {
        const { data } = await supabase
          .from('clients')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('status', 'active')
          .ilike('identifier_value', `${identifierPrefix}%`)
          .maybeSingle();

        if (data) foundClient = data as LookedUpClient;
      }

      // If still not found, do exact identifier match
      if (!foundClient && request.identifier_value) {
        const { data } = await supabase
          .from('clients')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('status', 'active')
          .ilike('identifier_value', request.identifier_value)
          .maybeSingle();

        if (data) foundClient = data as LookedUpClient;
      }

      if (foundClient) {
        const result: ClientLookupResult = {
          found: true,
          client: foundClient,
          pendingClient: null,
          isNewClient: false,
        };
        setLookupResult(result);
        return result;
      }

      // Client not found - prepare pending client data
      // This will be saved only when the invoice is validated
      const pendingClient: PendingClientData = {
        client_type: request.client_type === 'company' ? 'business_local' : 
                     request.client_type === 'individual' ? 'individual_local' : 
                     request.client_type as string,
        first_name: request.first_name || null,
        last_name: request.last_name || null,
        company_name: request.company_name || null,
        identifier_type: request.identifier_type,
        identifier_value: request.identifier_value,
        country: request.country || 'Tunisie',
        governorate: request.governorate || null,
        address: request.address || null,
        postal_code: request.postal_code || null,
        phone_prefix: request.phone_prefix || null,
        phone: request.phone || null,
        whatsapp_prefix: request.whatsapp_prefix || null,
        whatsapp: request.whatsapp || null,
        email: request.email || null,
      };

      const result: ClientLookupResult = {
        found: false,
        client: null,
        pendingClient,
        isNewClient: true,
      };
      setLookupResult(result);
      return result;

    } catch (error) {
      console.error('Error looking up client:', error);
      return { found: false, client: null, pendingClient: null, isNewClient: false };
    } finally {
      setIsLooking(false);
    }
  }, [organizationId]);

  /**
   * Create the pending client in database and return the new client ID
   * This should be called only when the invoice is validated
   */
  const createClientFromPending = useCallback(async (
    pendingClient: PendingClientData
  ): Promise<string | null> => {
    if (!organizationId) return null;

    try {
      // Double-check the client doesn't exist
      const { data: existing } = await supabase
        .from('clients')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('identifier_value', pendingClient.identifier_value)
        .maybeSingle();

      if (existing) {
        return existing.id;
      }

      // Create new client
      const { data: newClient, error } = await supabase
        .from('clients')
        .insert({
          organization_id: organizationId,
          client_type: pendingClient.client_type as 'individual_local' | 'business_local' | 'foreign',
          first_name: pendingClient.first_name,
          last_name: pendingClient.last_name,
          company_name: pendingClient.company_name,
          identifier_type: pendingClient.identifier_type,
          identifier_value: pendingClient.identifier_value,
          country: pendingClient.country,
          governorate: pendingClient.governorate,
          address: pendingClient.address,
          postal_code: pendingClient.postal_code,
          phone_prefix: pendingClient.phone_prefix,
          phone: pendingClient.phone,
          whatsapp_prefix: pendingClient.whatsapp_prefix,
          whatsapp: pendingClient.whatsapp,
          email: pendingClient.email,
          status: 'active',
        })
        .select('id')
        .single();

      if (error) throw error;
      return newClient?.id || null;

    } catch (error) {
      console.error('Error creating client:', error);
      return null;
    }
  }, [organizationId]);

  /**
   * Reset the lookup state
   */
  const resetLookup = useCallback(() => {
    setLookupResult(null);
  }, []);

  return {
    isLooking,
    lookupResult,
    lookupClientFromRequest,
    createClientFromPending,
    resetLookup,
  };
};
