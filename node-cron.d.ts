declare module 'node-cron' {
  interface ScheduleOptions {
    timezone?: string;
  }

  interface Task {
    start(): void;
    stop(): void;
    destroy(): void;
  }

  function schedule(
    expression: string,
    func: () => void | Promise<void>,
    options?: ScheduleOptions
  ): Task;

  function validate(expression: string): boolean;

  const cron: {
    schedule: typeof schedule;
    validate: typeof validate;
  };

  export default cron;
}
