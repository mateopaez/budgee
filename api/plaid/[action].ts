import { handleWebPlaid } from '../../server/plaid/vercel';

export const maxDuration = 60;

export function POST(request: Request): Promise<Response> {
  return handleWebPlaid(request);
}

export default {
  fetch(request: Request): Promise<Response> {
    return handleWebPlaid(request);
  },
};
