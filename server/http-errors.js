export class HttpError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export const badRequest = message => new HttpError(message, 400);
export const unauthorized = message => new HttpError(message, 401);
export const notFound = message => new HttpError(message, 404);
export const conflict = message => new HttpError(message, 409);
export const payloadTooLarge = message => new HttpError(message, 413);

