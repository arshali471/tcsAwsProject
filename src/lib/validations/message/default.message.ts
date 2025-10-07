import { JoiHandler } from "../../../helper/joi.handler";

export class DefaultMessage {
  static defaultRequired(variableName: string) {
    return {
      "string.empty": JoiHandler.requiredMessage(variableName),
      "any.required": JoiHandler.requiredMessage(variableName),
    };
  }
}
