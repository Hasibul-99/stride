import { Module } from '@nestjs/common';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';
import { SearchController } from '../search/search.controller';
import { SearchService } from '../search/search.service';

@Module({
  controllers: [NotesController, SearchController],
  providers: [NotesService, SearchService],
})
export class NotesModule {}
