// =============================================================================
// modules/catalog/services/catalog-service.ts
// Serviço de catálogo: leitura de serviços ativos do banco.
// Dados servidos com cache stale-while-revalidate via route handler.
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import type { QuickService } from '@/lib/types';

type ServiceResult<T> =
  | { success: true;  data: T }
  | { success: false; error: string; code?: number };

// Retorna todos os serviços ativos ordenados por sort_order
export async function getActiveServices(): Promise<ServiceResult<QuickService[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('quick_services')
    .select(
      'id, name, category, fixed_price, platform_fee, icon, is_active, included, not_included, duration_est'
    )
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[catalog-service] getActiveServices error:', error.message);
    return { success: false, error: 'Falha ao carregar catálogo', code: 500 };
  }

  return { success: true, data: (data ?? []) as QuickService[] };
}

// Retorna um serviço específico por ID (valida existência e atividade)
export async function getServiceById(
  serviceId: string
): Promise<ServiceResult<QuickService>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('quick_services')
    .select(
      'id, name, category, fixed_price, platform_fee, icon, is_active, included, not_included, duration_est'
    )
    .eq('id', serviceId)
    .single();

  if (error || !data) {
    return { success: false, error: 'Serviço não encontrado', code: 404 };
  }

  if (!data.is_active) {
    return { success: false, error: 'Serviço temporariamente indisponível', code: 422 };
  }

  return { success: true, data: data as QuickService };
}

// Calcula e valida repasse líquido (piso de R$ 50)
export function calculateProviderCut(
  fixedPrice:  number,
  platformFee: number
): { providerCut: number; isAboveFloor: boolean } {
  const providerCut  = fixedPrice - platformFee;
  const isAboveFloor = providerCut >= 50;
  return { providerCut, isAboveFloor };
}
