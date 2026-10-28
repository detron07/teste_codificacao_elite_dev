import { IsInt, Max, Min } from 'class-validator';

export class DepositDto {
  @IsInt({ message: 'O valor do depósito deve ser um número inteiro em centavos' })
  @Min(100, { message: 'O valor mínimo de depósito é de R$ 1,00 (100 centavos)' })
  @Max(10_000_000_00, {
    message: 'O valor máximo por depósito é de R$ 10.000.000,00 (1 bilhão de centavos)',
  })
  amountCents: number;
}
