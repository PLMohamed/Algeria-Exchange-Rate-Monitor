import { Test, TestingModule } from '@nestjs/testing';
import { BankOfAlgeriaService } from './bank-of-algeria.service.js';

describe('BankOfAlgeriaService', () => {
  let service: BankOfAlgeriaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BankOfAlgeriaService],
    }).compile();

    service = module.get<BankOfAlgeriaService>(BankOfAlgeriaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
