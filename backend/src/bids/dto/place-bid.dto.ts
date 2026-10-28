import { IsInt, Min } from 'class-validator';

export class PlaceBidDto {
  @IsInt({ message: 'O valor do lance deve ser um número inteiro em centavos' })
  @Min(100, { message: 'O valor do lance deve ser de no mínimo R$ 1,00 (100 centavos)' })
  amountCents: number;
}
