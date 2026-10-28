import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { AuditService } from './audit.service';
import { LotAuditResult } from './audit.types';

@Controller('lots/:id')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Endpoint publico para auditoria criptografica da cadeia de lances de um lote.
   * Valida a integridade da hash chain e verifica se houve adulteracao de valores ou sequencia.
   */
  @Public()
  @Get('audit')
  auditLot(@Param('id') lotId: string): Promise<LotAuditResult> {
    return this.auditService.auditLot(lotId);
  }
}
