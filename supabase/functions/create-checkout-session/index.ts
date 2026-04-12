import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

function getCorsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const cors = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const { invoice_id, success_url, cancel_url } = await req.json();
    if (!invoice_id) {
      return new Response(JSON.stringify({ error: 'Missing invoice_id' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .select('id, invoice_number, total, tax_amount, subtotal, status, client_id, clients!invoices_client_id_fkey(id, email, first_name, last_name)')
      .eq('id', invoice_id)
      .single();

    if (invError || !invoice) {
      return new Response(JSON.stringify({ error: 'Invoice not found' }), {
        status: 404, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (invoice.status === 'Paid') {
      return new Response(JSON.stringify({ error: 'Invoice is already paid' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const { data: lineItems } = await supabase
      .from('invoice_line_items')
      .select('description, quantity, unit_price')
      .eq('invoice_id', invoice_id);

    const stripeLineItems = (lineItems || []).map((item: any) => ({
      price_data: {
        currency: 'usd',
        product_data: { name: item.description },
        unit_amount: Math.round(item.unit_price * 100),
      },
      quantity: item.quantity || 1,
    }));

    if (invoice.tax_amount && invoice.tax_amount > 0) {
      stripeLineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: 'Tax' },
          unit_amount: Math.round(invoice.tax_amount * 100),
        },
        quantity: 1,
      });
    }

    if (stripeLineItems.length === 0) {
      stripeLineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: `Invoice ${invoice.invoice_number}` },
          unit_amount: Math.round(invoice.total * 100),
        },
        quantity: 1,
      });
    }

    const clientData = invoice.clients as any;
    const customerEmail = clientData?.email || undefined;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: stripeLineItems,
      customer_email: customerEmail,
      metadata: {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
      },
      success_url: success_url || `${origin}/owner/invoices?payment=success&invoice=${invoice_id}`,
      cancel_url: cancel_url || `${origin}/owner/invoices?payment=cancelled`,
    });

    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('create-checkout-session error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
