// An error with a user facing message and an HTTP status.
export class ScanError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ScanError";
  }
}
