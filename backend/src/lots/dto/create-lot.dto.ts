import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateLotDto {
  @Transform(trim)
  @IsString()
  @Length(2, 200, { message: 'O título deve ter entre 2 e 200 caracteres' })
  title: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  description?: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'O identificador do item externo é obrigatório' })
  externalItemId: string;

  @Transform(trim)
  @IsUrl({}, { message: 'A URL da imagem deve ser válida' })
  imageUrl: string;

  @IsObject({ message: 'Os atributos do item devem ser um objeto válido' })
  itemAttributes: Record<string, unknown>;

  @IsInt({ message: 'O lance inicial deve ser um valor inteiro em centavos' })
  @Min(100, { message: 'O lance inicial deve ser de no mínimo R$ 1,00 (100 centavos)' })
  startPriceCents: number;

  @IsInt({ message: 'O incremento mínimo deve ser um valor inteiro em centavos' })
  @Min(50, { message: 'O incremento mínimo deve ser de no mínimo R$ 0,50 (50 centavos)' })
  minIncrementCents: number;

  @IsOptional()
  @IsDateString({}, { message: 'Data de início inválida' })
  startsAt?: string;

  @IsDateString({}, { message: 'Data de término inválida' })
  endsAt: string;
}
