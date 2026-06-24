import { Controller, Get, Post, Put, Body, Param, Headers, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UsersService, UpdateProfileDto } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('auth')
  @ApiOperation({ summary: 'Authenticate / register user by wallet address' })
  async auth(@Headers('x-wallet-address') walletAddress: string) {
    return this.usersService.upsertUser(walletAddress);
  }

  @Get('me')
  @ApiOperation({ summary: "Get authenticated user's profile" })
  async getMe(@Headers('x-wallet-address') walletAddress: string) {
    return this.usersService.getProfile(walletAddress);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update authenticated user profile' })
  async updateMe(
    @Headers('x-wallet-address') walletAddress: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(walletAddress, dto);
  }

  @Get('me/history')
  @ApiOperation({ summary: "Get authenticated user's prediction history" })
  async getHistory(
    @Headers('x-wallet-address') walletAddress: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.usersService.getPredictionHistory(walletAddress, page, limit);
  }

  @Get(':walletAddress/profile')
  @ApiOperation({ summary: "Get public profile by wallet address" })
  async getProfile(@Param('walletAddress') walletAddress: string) {
    return this.usersService.getProfile(walletAddress);
  }
}
