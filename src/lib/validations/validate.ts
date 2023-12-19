import Joi from "joi";
import express from "express";
import { Response } from "../../util/util";

export function Validate(validationSchema: Joi.Schema) {
  return function (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    let result = validationSchema.validate(req.body);
    if (result.error) {
      return res.status(400).send(result.error.message);
    } else {
      next();
    }
  };
}

export function ValidateParams(validationSchema: Joi.Schema) {
  return function (req: express.Request, res: express.Response, next: express.NextFunction) {
      let result = validationSchema.validate(req.params);
      if (result.error) {
          return res.status(400).send(new Response({}, result.error.message, 400));
      } else {
          next();
      }
  }
}
