export class JoiHandler {
  static requiredMessage(variable: string) {
    return `${variable} is required cannot be empty`;
  }
  static typeMessage(variable: string, type: string) {
    return `${variable} is of type ${type}`;
  }
  static requiredMin(variable: string, minLength: number | string) {
    return `${variable} should have a minimum length of ${String(minLength)}`;
  }
  static requiredMax(variable: string, maxLength: number | string) {
    return `${variable} can have a maximum length of ${String(maxLength)}`;
  }
}
