import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class BidsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(BidsGateway.name);

  handleConnection(client: Socket): void {
    this.logger.debug(`Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Cliente desconectado: ${client.id}`);
  }

  /**
   * Conecta o cliente a sala de um lote especifico para receber lances ao vivo.
   */
  @SubscribeMessage('join:lot')
  handleJoinLot(@ConnectedSocket() client: Socket, @MessageBody() data: { lotId: string }): void {
    if (data?.lotId) {
      void client.join(`lot:${data.lotId}`);
      this.logger.debug(`Cliente ${client.id} entrou na sala do lote ${data.lotId}`);
    }
  }

  /**
   * Remove o cliente da sala do lote.
   */
  @SubscribeMessage('leave:lot')
  handleLeaveLot(@ConnectedSocket() client: Socket, @MessageBody() data: { lotId: string }): void {
    if (data?.lotId) {
      void client.leave(`lot:${data.lotId}`);
      this.logger.debug(`Cliente ${client.id} saiu da sala do lote ${data.lotId}`);
    }
  }

  /**
   * Conecta o cliente a sala da vitrine para atualizacoes de precos e novos lotes.
   */
  @SubscribeMessage('join:showcase')
  handleJoinShowcase(@ConnectedSocket() client: Socket): void {
    void client.join('showcase');
    this.logger.debug(`Cliente ${client.id} entrou na sala da vitrine`);
  }

  /**
   * Notifica todos os clientes assistindo ao lote sobre um novo lance aceito.
   */
  broadcastNewBid(lotId: string, eventData: unknown): void {
    if (this.server) {
      this.server.to(`lot:${lotId}`).emit('bid:new', eventData);
    }
  }

  /**
   * Notifica a vitrine publica sobre a atualizacao de precos/termino de um lote.
   */
  broadcastLotUpdated(eventData: unknown): void {
    if (this.server) {
      this.server.to('showcase').emit('lot:updated', eventData);
    }
  }

  /**
   * Notifica os clientes da sala e da vitrine sobre a liquidacao e encerramento de um lote.
   */
  broadcastLotSettled(lotId: string, eventData: unknown): void {
    if (this.server) {
      this.server.to(`lot:${lotId}`).emit('lot:settled', eventData);
      this.server.to('showcase').emit('lot:settled', eventData);
    }
  }

  /**
   * Notifica os clientes da sala e da vitrine sobre o cancelamento de um lote.
   */
  broadcastLotCancelled(lotId: string, eventData: unknown): void {
    if (this.server) {
      this.server.to(`lot:${lotId}`).emit('lot:cancelled', eventData);
      this.server.to('showcase').emit('lot:cancelled', eventData);
    }
  }
}
