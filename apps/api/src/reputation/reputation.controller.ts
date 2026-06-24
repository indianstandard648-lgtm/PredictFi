import { Controller, Get, Param, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ReputationService } from './reputation.service';

@ApiTags('reputation')
@Controller('reputation')
export class ReputationController {
  constructor(private readonly reputationService: ReputationService) {}

  @Get('me')
  @ApiOperation({ summary: "Get authenticated user's reputation" })
  async getMyReputation(@Headers('x-wallet-address') walletAddress: string) {
    return this.reputationService.getReputation(walletAddress);
  }

  @Get(':walletAddress')
  @ApiOperation({ summary: "Get any user's reputation by wallet address" })
  async getReputation(@Param('walletAddress') walletAddress: string) {
    return this.reputationService.getReputation(walletAddress);
  }
}
