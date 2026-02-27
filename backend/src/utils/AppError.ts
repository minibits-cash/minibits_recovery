import { log } from '../services/logService'

export function isObj(v: unknown): v is object {
  return typeof v === 'object'
}

export enum Err {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOTFOUND_ERROR = 'NOTFOUND_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface IAppError {
  statusCode: number
  name: Err
  message: string
  params?: unknown
}

class AppError extends Error {
  public statusCode: number
  public name: Err
  public message: string
  public params?: { caller?: string; [key: string]: unknown }

  constructor(
    statusCode: number,
    name: Err = Err.UNKNOWN_ERROR,
    message: string,
    params?: { caller?: string; [key: string]: unknown },
  ) {
    super(name)
    this.statusCode = statusCode
    this.name = name
    this.message = message
    this.params = params

    const caller = params?.caller ?? 'unknown'
    log.error(
      `[${caller}]`,
      name,
      isObj(message) ? JSON.stringify(message) : message,
      JSON.stringify(params),
    )

    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export default AppError
