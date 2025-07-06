import { Response } from 'express';
import { ApiResponse } from '../types';

export class ResponseHandler {
  static success<T>(
    res: Response, 
    data?: T, 
    message?: string, 
    statusCode: number = 200
  ): Response<ApiResponse<T>> {
    const response: ApiResponse<T> = {
      success: true,
      ...(message && { message }),
      ...(data && { data })
    };

    return res.status(statusCode).json(response);
  }

  static error(
    res: Response,
    message: string,
    statusCode: number = 500,
    error?: string,
    errors?: any[]
  ): Response<ApiResponse> {
    const response: ApiResponse = {
      success: false,
      message,
      ...(error && { error }),
      ...(errors && { errors })
    };

    return res.status(statusCode).json(response);
  }

  static created<T>(
    res: Response,
    data: T,
    message?: string
  ): Response<ApiResponse<T>> {
    return this.success(res, data, message, 201);
  }

  static notFound(
    res: Response,
    message: string = 'Resource not found'
  ): Response<ApiResponse> {
    return this.error(res, message, 404);
  }

  static badRequest(
    res: Response,
    message: string = 'Bad request',
    errors?: any[]
  ): Response<ApiResponse> {
    return this.error(res, message, 400, undefined, errors);
  }

  static unauthorized(
    res: Response,
    message: string = 'Unauthorized',
    error?: string
  ): Response<ApiResponse> {
    return this.error(res, message, 401, error);
  }

  static forbidden(
    res: Response,
    message: string = 'Forbidden'
  ): Response<ApiResponse> {
    return this.error(res, message, 403);
  }

  static conflict(
    res: Response,
    message: string = 'Conflict'
  ): Response<ApiResponse> {
    return this.error(res, message, 409);
  }

  static paginated<T>(
    res: Response,
    data: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    },
    message?: string
  ): Response<ApiResponse<T[]>> {
    const response: ApiResponse<T[]> = {
      success: true,
      ...(message && { message }),
      data,
      pagination
    };

    return res.status(200).json(response);
  }
} 