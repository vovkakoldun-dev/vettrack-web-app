import { loadStripe } from '@stripe/stripe-js';

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

export const stripePromise = stripePublishableKey
  ? loadStripe(stripePublishableKey)
  : null;

export function isStripeConfigured(): boolean {
  return !!stripePublishableKey;
}
