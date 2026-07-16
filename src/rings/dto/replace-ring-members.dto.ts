import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class ReplaceRingMembersDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  memberIds!: string[];
}
