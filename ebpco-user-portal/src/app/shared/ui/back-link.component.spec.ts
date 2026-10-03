import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { BackLinkComponent } from './back-link.component';
import { NavigationHistory } from '../../core/utils/navigation-history';

@Component({
  imports: [BackLinkComponent],
  template: `<app-back-link fallback="/applications" fallbackLabel="My Applications" />`,
})
class HostPage {}

/**
 * QA TC-19 / TC-29 (2026-10-03): the link named and returned to whatever came
 * before -- "Back to Application Form" right after submitting, which opened a
 * blank application. On a signed-in page it names and opens the parent.
 */
describe('BackLinkComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('names the parent page, and opens it, whatever came before', () => {
    const back = vi.fn();
    TestBed.configureTestingModule({
      imports: [HostPage],
      providers: [provideRouter([]), { provide: NavigationHistory, useValue: { back, label: () => 'Application Form' } }],
    });
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(HostPage);
    fixture.detectChanges();

    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    expect(button.textContent).toContain('Back to My Applications');
    expect(button.textContent).not.toContain('Application Form');

    button.click();
    expect(navigate).toHaveBeenCalledWith('/applications');
    expect(back).not.toHaveBeenCalled();
  });
});
