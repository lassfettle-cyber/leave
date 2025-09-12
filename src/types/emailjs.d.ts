declare module 'emailjs' {
  export class SMTPClient {
    constructor(options: any)
    send(message: any, callback: (err: any, result: any) => void): void
  }
}

