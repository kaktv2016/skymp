import {test,expect,vi,afterEach} from 'vitest';
import {TaskRunner,CancelledTask} from './routing-client';
afterEach(()=>vi.useRealTimers());
test('cancels an obsolete worker and rejects late messages instead of returning stale geometry',async()=>{
 const workers:any[]=[];const factory=()=>{const worker={onmessage:null,onerror:null,postMessage:vi.fn(),terminate:vi.fn()};workers.push(worker);return worker;};
 const runner=new TaskRunner<number,string>(factory,1000),first=runner.run(1).catch(e=>e),old=workers[0].onmessage;const second=runner.run(2);expect(await first).toBeInstanceOf(CancelledTask);expect(workers[0].terminate).toHaveBeenCalled();old({data:{id:1,value:'stale'}});const request=workers[1].postMessage.mock.calls[0][0];workers[1].onmessage({data:{id:request.id,value:'current'}});expect(await second).toBe('current');runner.dispose();
});
test('times out a stuck computation, terminates its worker and accepts a fresh later request',async()=>{vi.useFakeTimers();const workers:any[]=[];const runner=new TaskRunner<number,string>(()=>{const w={onmessage:null,onerror:null,postMessage:vi.fn(),terminate:vi.fn()};workers.push(w);return w;},50);const request=runner.run(1).catch(e=>e);await vi.advanceTimersByTimeAsync(51);expect((await request).message).toMatch(/timed out/);expect(workers[0].terminate).toHaveBeenCalled();const next=runner.run(2);workers[1].onmessage({data:{id:workers[1].postMessage.mock.calls[0][0].id,value:'fresh'}});expect(await next).toBe('fresh');runner.dispose();});
