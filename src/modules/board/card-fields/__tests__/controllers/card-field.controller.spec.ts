import { CardFieldDefController } from '../../controllers/card-field-def.controller';
import { CardFieldValueController } from '../../controllers/card-field-value.controller';
import { CardFieldService } from '../../services/card-field.service';

describe('CardField controllers', () => {
  let defController: CardFieldDefController;
  let valueController: CardFieldValueController;
  let fieldService: jest.Mocked<CardFieldService>;
  const mockUser = { sub: 'user-1' } as any;

  beforeEach(() => {
    fieldService = {
      createDef: jest.fn(),
      listDefs: jest.fn(),
      updateDef: jest.fn(),
      deleteDef: jest.fn(),
      setValue: jest.fn(),
      listValues: jest.fn(),
    } as unknown as jest.Mocked<CardFieldService>;
    defController = new CardFieldDefController(fieldService);
    valueController = new CardFieldValueController(fieldService);
  });

  it('should be defined', () => {
    expect(defController).toBeDefined();
    expect(valueController).toBeDefined();
  });

  it('should create, list, update and delete defs', async () => {
    fieldService.createDef.mockResolvedValue({ id: 'f-1' } as any);
    await expect(
      defController.createDef(
        'ws-1',
        { name: 'P', fieldType: 'number' } as any,
        mockUser,
      ),
    ).resolves.toEqual({ id: 'f-1' });
    fieldService.listDefs.mockResolvedValue([{ id: 'f-1' }] as any);
    await expect(defController.listDefs('ws-1')).resolves.toHaveLength(1);
    fieldService.updateDef.mockResolvedValue({ id: 'f-1' } as any);
    await expect(
      defController.updateDef('ws-1', 'f-1', {} as any),
    ).resolves.toBeDefined();
    await defController.deleteDef('ws-1', 'f-1');
    expect(fieldService.deleteDef).toHaveBeenCalledWith('ws-1', 'f-1');
  });

  it('should set and list values', async () => {
    fieldService.setValue.mockResolvedValue({ id: 'v-1' } as any);
    await expect(
      valueController.setValue('ws-1', 'b-1', 'c-1', 'f-1', { value: 'x' }),
    ).resolves.toEqual({ id: 'v-1' });
    fieldService.listValues.mockResolvedValue([{ id: 'v-1' }] as any);
    await expect(
      valueController.listValues('ws-1', 'b-1', 'c-1'),
    ).resolves.toHaveLength(1);
  });
});
