import { 
  ClickConfig, 
  ClickRequestDTO, 
  ClickError, 
  TransactionActions,
  ClickPrepareResponse,
  ClickCompleteResponse
} from './types';
import crypto from 'crypto';

export class ClickPayment {
  private readonly config: ClickConfig;

  constructor(config: ClickConfig) {
    this.config = config;
  }

  private generateMD5(params: Record<string, any>): string {
    const signString = Object.values(params).join('');
    return crypto
      .createHash('md5')
      .update(signString)
      .digest('hex');
  }

  private validateSignString(data: ClickRequestDTO, includesPrepareId = false): boolean {
    const md5Params: Record<string, any> = {
      clickTransId: data.click_trans_id,
      serviceId: data.service_id,
      secretKey: this.config.secretKey,
      merchantTransId: data.merchant_trans_id,
      amount: data.amount,
      action: data.action,
      signTime: data.sign_time,
    };

    if (includesPrepareId) {
      md5Params.merchantPrepareId = data.merchant_prepare_id;
    }

    const md5Hash = this.generateMD5(md5Params);
    return data.sign_string === md5Hash;
  }

  private createErrorResponse(error: ClickError, errorNote: string, data: ClickRequestDTO): ClickPrepareResponse | ClickCompleteResponse {
    // Call onFail handler if provided
    if (this.config.handle.onFail) {
      this.config.handle.onFail({
        click_trans_id: data.click_trans_id,
        merchant_trans_id: data.merchant_trans_id,
        error,
        error_note: errorNote
      }).catch(console.error);
    }

    return {
      click_trans_id: data.click_trans_id,
      merchant_trans_id: data.merchant_trans_id,
      ...(data.action === TransactionActions.Prepare ? { merchant_prepare_id: '' } : {}),
      error,
      error_note: errorNote
    };
  }

  private async prepare(data: ClickRequestDTO): Promise<ClickPrepareResponse> {
    try {
      // 1. Validate sign string
      if (!this.validateSignString(data)) {
        return this.createErrorResponse(
          ClickError.SignFailed,
          'Invalid sign_string',
          data
        ) as ClickPrepareResponse;
      }

      // 2. Check if order exists and get amount
      const order = await this.config.validate.checkOrder(data.merchant_trans_id);
      if (!order.exists) {
        return this.createErrorResponse(
          ClickError.UserNotFound,
          'Order not found',
          data
        ) as ClickPrepareResponse;
      }

      // 3. Validate amount
      if (order.amount && order.amount !== data.amount) {
        return this.createErrorResponse(
          ClickError.InvalidAmount,
          'Invalid amount',
          data
        ) as ClickPrepareResponse;
      }

      // 4. Check if already paid
      if (this.config.validate.checkPayment) {
        const isPaid = await this.config.validate.checkPayment(data.merchant_trans_id);
        if (isPaid) {
          return this.createErrorResponse(
            ClickError.AlreadyPaid,
            'Already paid',
            data
          ) as ClickPrepareResponse;
        }
      }

      // 5. Save prepare info
      const { prepare_id } = await this.config.handle.onPrepare({
        click_trans_id: data.click_trans_id,
        merchant_trans_id: data.merchant_trans_id,
        amount: data.amount
      });

      // Success response
      return {
        click_trans_id: data.click_trans_id,
        merchant_trans_id: data.merchant_trans_id,
        merchant_prepare_id: prepare_id,
        error: ClickError.Success,
        error_note: 'Success'
      };
    } catch (error) {
      console.error('Click prepare error:', error);
      return this.createErrorResponse(
        ClickError.UserNotFound,
        'Internal prepare error',
        data
      ) as ClickPrepareResponse;
    }
  }

  private async complete(data: ClickRequestDTO): Promise<ClickCompleteResponse> {
    try {
      // 1. Validate sign string
      if (!this.validateSignString(data, true)) {
        return this.createErrorResponse(
          ClickError.SignFailed,
          'Invalid sign_string',
          data
        ) as ClickCompleteResponse;
      }

      // 2. Check if order exists
      const order = await this.config.validate.checkOrder(data.merchant_trans_id);
      if (!order.exists) {
        return this.createErrorResponse(
          ClickError.UserNotFound,
          'Order not found',
          data
        ) as ClickCompleteResponse;
      }

      // 3. Handle Click error if present
      if (parseInt(data.error) > 0) {
        return this.createErrorResponse(
          parseInt(data.error),
          'Click error',
          data
        ) as ClickCompleteResponse;
      }

      // 4. Update payment status
      await this.config.handle.onSuccess({
        click_trans_id: data.click_trans_id,
        merchant_trans_id: data.merchant_trans_id,
        merchant_prepare_id: data.merchant_prepare_id
      });

      // Success response
      return {
        click_trans_id: data.click_trans_id,
        merchant_trans_id: data.merchant_trans_id,
        error: ClickError.Success,
        error_note: 'Success'
      };
    } catch (error) {
      console.error('Click complete error:', error);
      return this.createErrorResponse(
        ClickError.UserNotFound,
        'Internal complete error',
        data
      ) as ClickCompleteResponse;
    }
  }

  public async handleTransaction(data: ClickRequestDTO): Promise<ClickPrepareResponse | ClickCompleteResponse> {
    const actionType = +data.action;

    switch (actionType) {
      case TransactionActions.Prepare:
        return this.prepare(data);
      case TransactionActions.Complete:
        return this.complete(data);
      default:
        return this.createErrorResponse(
          ClickError.ActionNotFound,
          'Invalid action',
          data
        );
    }
  }
}
