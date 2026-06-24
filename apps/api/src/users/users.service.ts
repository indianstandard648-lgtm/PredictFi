import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  bio?: string;

  @IsOptional()
  @IsString()
  twitterHandle?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async upsertUser(walletAddress: string) {
    return this.prisma.user.upsert({
      where: { walletAddress },
      update: {},
      create: { walletAddress },
      include: { reputation: true },
    });
  }

  async getProfile(walletAddress: string) {
    const user = await this.prisma.user.findUnique({
      where: { walletAddress },
      include: {
        reputation: true,
        markets: {
          select: { id: true, title: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        positions: {
          select: {
            id: true,
            marketId: true,
            side: true,
            status: true,
            amountUsdc: true,
            sharesOwned: true,
            profit: true,
            createdAt: true,
            market: { select: { id: true, title: true, status: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(walletAddress: string, dto: UpdateProfileDto) {
    if (dto.username) {
      const exists = await this.prisma.user.findUnique({
        where: { username: dto.username },
      });
      if (exists && exists.walletAddress !== walletAddress) {
        throw new ConflictException('Username already taken');
      }
    }

    return this.prisma.user.update({
      where: { walletAddress },
      data: {
        username: dto.username,
        bio: dto.bio,
        twitterHandle: dto.twitterHandle,
        avatarUrl: dto.avatarUrl,
      },
    });
  }

  async getPredictionHistory(walletAddress: string, page = 1, limit = 20) {
    const user = await this.prisma.user.findUnique({ where: { walletAddress } });
    if (!user) throw new NotFoundException('User not found');

    const [positions, total] = await Promise.all([
      this.prisma.position.findMany({
        where: { userId: user.id },
        include: {
          market: {
            select: { id: true, title: true, status: true, resolution: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.position.count({ where: { userId: user.id } }),
    ]);

    return { positions, total, page, limit };
  }
}
