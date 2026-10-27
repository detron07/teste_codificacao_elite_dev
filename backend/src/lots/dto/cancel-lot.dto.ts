import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CancelLotDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'O motivo do cancelamento não pode exceder 255 caracteres' })
  reason?: string;
}
