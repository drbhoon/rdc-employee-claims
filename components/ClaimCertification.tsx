export function ClaimCertification() {
  return (
    <div className="rounded-md border border-line bg-panel p-4 text-sm leading-6">
      <label className="flex items-start gap-3">
        <input
          className="mt-1 h-4 w-4"
          type="checkbox"
          name="claimCertification"
          value="accepted"
          required
        />
        <span>
          I <strong>certify that all attached bills are authentic copies of the originals</strong>, without any alterations or editing. I <strong>confirm that the mode of travel</strong> (Car/Bike/Bus) indicated was actually used, and I am <strong>not claiming a higher mode</strong> of transport than utilized. Furthermore, I certify that <strong>none of these expenses have been claimed previously</strong>, nor have they been <strong>claimed by any colleague</strong> who shared the expenses during a joint visit.
        </span>
      </label>
    </div>
  );
}
