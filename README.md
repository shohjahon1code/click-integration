# Click Payment Integration

Easy Click payment integration for Node.js and NestJS applications. Just provide your validation and handler functions - we handle the rest!

## Features

✨ Works with Express, NestJS, and other frameworks  
🔒 Built-in signature validation  
⚡ Automatic error handling  
🛡️ Security checks included  
📝 Full TypeScript support  

## Installation

```bash
npm install click-uz-integration
```

## Express Usage

```typescript
import express from 'express';
import { ClickPayment } from 'click-uz-integration';

const app = express();
app.use(express.json());

// Initialize Click with your functions
const clickPayment = new ClickPayment({
  serviceId: process.env.CLICK_SERVICE_ID,
  merchantId: process.env.CLICK_MERCHANT_ID,
  secretKey: process.env.CLICK_SECRET_KEY,
  
  // Validation functions
  validate: {
    // Check if order exists
    checkOrder: async (orderId) => {
      const order = await Order.findById(orderId);
      return {
        exists: !!order,
        amount: order?.amount
      };
    },
    // Optional: Check if already paid
    checkPayment: async (orderId) => {
      const payment = await Payment.findOne({
        orderId,
        status: 'PAID'
      });
      return !!payment;
    }
  },

  // Handler functions
  handle: {
    // Save payment info when Click starts payment
    onPrepare: async (data) => {
      const payment = await Payment.create({
        orderId: data.merchant_trans_id,
        clickTransId: data.click_trans_id,
        amount: data.amount,
        status: 'PENDING'
      });
      return { prepare_id: payment.id };
    },

    // Update status when payment succeeds
    onSuccess: async (data) => {
      // Update payment status
      await Payment.findByIdAndUpdate(
        data.merchant_prepare_id,
        { status: 'PAID' }
      );

      // Update order status
      await Order.findByIdAndUpdate(
        data.merchant_trans_id,
        { status: 'PAID' }
      );
    },

    // Optional: Handle failed payments
    onFail: async (data) => {
      await Payment.findOneAndUpdate(
        { clickTransId: data.click_trans_id },
        { 
          status: 'FAILED',
          error: data.error,
          errorNote: data.error_note
        }
      );
    }
  }
});

// Handle Click payments
app.post('/click/payment', async (req, res) => {
  const result = await clickPayment.handleTransaction(req.body);
  res.json(result);
});
```

## NestJS Usage

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { ClickPayment } from 'click-uz-integration';

@Controller('payments')
export class PaymentController {
  private readonly clickPayment: ClickPayment;

  constructor(
    private readonly orderService: OrderService,
    private readonly paymentService: PaymentService
  ) {
    this.clickPayment = new ClickPayment({
      serviceId: process.env.CLICK_SERVICE_ID,
      merchantId: process.env.CLICK_MERCHANT_ID,
      secretKey: process.env.CLICK_SECRET_KEY,
      
      validate: {
        checkOrder: async (orderId) => {
          const order = await this.orderService.findById(orderId);
          return {
            exists: !!order,
            amount: order?.amount
          };
        },
        checkPayment: async (orderId) => {
          return this.paymentService.isPaid(orderId);
        }
      },

      handle: {
        onPrepare: async (data) => {
          const payment = await this.paymentService.create({
            orderId: data.merchant_trans_id,
            clickTransId: data.click_trans_id,
            amount: data.amount,
            status: 'PENDING'
          });
          return { prepare_id: payment.id };
        },

        onSuccess: async (data) => {
          await this.paymentService.markAsPaid(data.merchant_prepare_id);
          await this.orderService.markAsPaid(data.merchant_trans_id);
        },

        onFail: async (data) => {
          await this.paymentService.markAsFailed(data.click_trans_id, {
            error: data.error,
            errorNote: data.error_note
          });
        }
      }
    });
  }

  @Post('click')
  async handleClickPayment(@Body() data: any) {
    return this.clickPayment.handleTransaction(data);
  }
}
```

## Required Functions

### Validation Functions

```typescript
validate: {
  // Required: Check if order exists
  checkOrder: async (orderId: string) => {
    return {
      exists: boolean;    // Does order exist?
      amount?: number;    // Order amount (optional)
    }
  },

  // Optional: Check if already paid
  checkPayment?: async (orderId: string) => {
    return boolean;  // Is payment completed?
  }
}
```

### Handler Functions

```typescript
handle: {
  // Required: Save payment info
  onPrepare: async (data: {
    click_trans_id: number;
    merchant_trans_id: string;
    amount: number;
  }) => {
    return {
      prepare_id: string | number;  // Your payment ID
    }
  },

  // Required: Handle successful payment
  onSuccess: async (data: {
    click_trans_id: number;
    merchant_trans_id: string;
    merchant_prepare_id: string;
  }) => {
    // Update payment/order status
  },

  // Optional: Handle failed payment
  onFail?: async (data: {
    click_trans_id: number;
    merchant_trans_id: string;
    error: number;
    error_note: string;
  }) => {
    // Update payment/order status
  }
}
```

## Environment Variables

```bash
# Required
CLICK_SERVICE_ID=your-service-id
CLICK_MERCHANT_ID=your-merchant-id
CLICK_SECRET_KEY=your-secret-key
```

## What's Included?

The package automatically:
- ✓ Validates signatures
- ✓ Validates requests
- ✓ Checks order existence
- ✓ Verifies amounts
- ✓ Checks for duplicates
- ✓ Handles payment status
- ✓ Manages Click errors

## Error Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| -1 | Sign check failed |
| -2 | Invalid amount |
| -3 | Action not found |
| -4 | Already paid |
| -5 | User/Order not found |
| -6 | Transaction not found |
| -7 | Transaction canceled |

## Links

- [Click API Documentation](https://docs.click.uz)
- [GitHub Repository](https://github.com/shohjahon1code/click-integration)
- [NPM Package](https://www.npmjs.com/package/click-integration)

## Support

Need help? Email us at suyunovshohjahon08@gmail.com
