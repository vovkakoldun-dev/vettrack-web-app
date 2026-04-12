import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

serve(async (req: Request) => {
  const cors: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing stripe-signature' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Helper: record payment and update invoice
    async function recordPayment(invoiceId: string, amountPaid: number, referenceNo: string, notes: string) {
      await supabase.from('payments').insert({
        invoice_id: invoiceId,
        amount: amountPaid,
        method: 'Credit Card',
        paid_at: new Date().toISOString(),
        reference_no: referenceNo,
        notes,
      });

      const { data: invoice } = await supabase
        .from('invoices')
        .select('total, amount_paid')
        .eq('id', invoiceId)
        .single();

      if (invoice) {
        const newAmountPaid = (invoice.amount_paid || 0) + amountPaid;
        const newStatus = newAmountPaid >= invoice.total ? 'Paid' : 'Partial';

        await supabase
          .from('invoices')
          .update({
            amount_paid: newAmountPaid,
            status: newStatus,
            paid_at: newStatus === 'Paid' ? new Date().toISOString() : null,
          })
          .eq('id', invoiceId);
      }

      console.log(`Payment recorded for invoice ${invoiceId}: $${amountPaid}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoiceId = session.metadata?.invoice_id;

      if (!invoiceId) {
        console.error('No invoice_id in session metadata');
        return new Response(JSON.stringify({ received: true }), {
          status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      const amountPaid = (session.amount_total || 0) / 100;
      await recordPayment(invoiceId, amountPaid, session.payment_intent as string, `Stripe Checkout ${session.id}`);
    }

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent;
      const invoiceId = pi.metadata?.invoice_id;

      if (invoiceId) {
        const amountPaid = pi.amount / 100;
        await recordPayment(invoiceId, amountPaid, pi.id, `Stripe Card Payment ${pi.id}`);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Webhook error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
