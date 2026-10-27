import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsString, Length, Matches, MaxLength } from 'class-validator';
import { Role } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @Transform(trim)
  @IsString()
  @Length(2, 120, { message: 'O nome deve ter entre 2 e 120 caracteres' })
  name: string;

  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Informe um e-mail válido' })
  @MaxLength(254)
  email: string;

  @IsString()
  @Length(8, 72, { message: 'A senha deve ter entre 8 e 72 caracteres' })
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, { message: 'A senha deve conter letras e números' })
  password: string;

  @IsIn(Object.values(Role), { message: 'Papel inválido: use AUCTIONEER ou BIDDER' })
  role: Role;
}
