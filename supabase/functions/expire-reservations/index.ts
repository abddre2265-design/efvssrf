import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find all expired active reservations
    const today = new Date().toISOString().split('T')[0];
    
    const { data: expiredReservations, error: fetchError } = await supabase
      .from('product_reservations')
      .select('id, product_id, quantity')
      .eq('status', 'active')
      .lt('expiration_date', today);

    if (fetchError) {
      throw fetchError;
    }

    if (!expiredReservations || expiredReservations.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No expired reservations found', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${expiredReservations.length} expired reservations`);

    // Group by product to update reserved_stock efficiently
    const productUpdates = new Map<string, number>();
    
    for (const reservation of expiredReservations) {
      const current = productUpdates.get(reservation.product_id) || 0;
      productUpdates.set(reservation.product_id, current + reservation.quantity);
    }

    // Update reservation statuses to 'expired'
    const reservationIds = expiredReservations.map(r => r.id);
    const { error: updateReservationsError } = await supabase
      .from('product_reservations')
      .update({ status: 'expired' })
      .in('id', reservationIds);

    if (updateReservationsError) {
      throw updateReservationsError;
    }

    // Update product reserved_stock values
    for (const [productId, quantityToRelease] of productUpdates) {
      // Get current reserved_stock
      const { data: product, error: productFetchError } = await supabase
        .from('products')
        .select('reserved_stock, unlimited_stock')
        .eq('id', productId)
        .single();

      if (productFetchError) {
        console.error(`Error fetching product ${productId}:`, productFetchError);
        continue;
      }

      // Only update if not unlimited stock
      if (!product.unlimited_stock) {
        const newReservedStock = Math.max(0, (product.reserved_stock || 0) - quantityToRelease);
        
        const { error: productUpdateError } = await supabase
          .from('products')
          .update({ reserved_stock: newReservedStock })
          .eq('id', productId);

        if (productUpdateError) {
          console.error(`Error updating product ${productId}:`, productUpdateError);
        }
      }
    }

    console.log(`Successfully processed ${expiredReservations.length} expired reservations`);

    return new Response(
      JSON.stringify({ 
        message: 'Expired reservations processed',
        processed: expiredReservations.length,
        productsUpdated: productUpdates.size
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error processing expired reservations:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
