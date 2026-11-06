import { Controller } from '@nestjs/common';
import { RatesService } from './rates.service.js';

@Controller('rates')
export class RatesController {
  constructor(private readonly ratesService: RatesService) {}
}
